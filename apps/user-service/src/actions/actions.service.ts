import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Action,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  Nursery,
  NurseryReport,
  User,
  Task
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { groupBy } from "lodash";
import { EntityModel, EntityType, formModelType } from "@terramatch-microservices/database/constants/entities";
import { ActionTarget } from "@terramatch-microservices/common/dto/action.dto";
import { ModelStatic, Includeable } from "sequelize";

type TargetableLoaderConfig = {
  model: ModelStatic<EntityModel>;
  include?: Includeable[];
};

const TARGETABLE_LOADERS: Record<string, TargetableLoaderConfig> = {
  [Project.LARAVEL_TYPE]: {
    model: Project
  },
  [ProjectReport.LARAVEL_TYPE]: {
    model: ProjectReport,
    include: [
      { association: "project", attributes: ["id", "uuid", "name"] },
      { association: "task", attributes: ["uuid"] }
    ]
  },
  [Site.LARAVEL_TYPE]: {
    model: Site,
    include: [{ association: "project", attributes: ["uuid", "name"] }]
  },
  [SiteReport.LARAVEL_TYPE]: {
    model: SiteReport,
    include: [
      {
        association: "site",
        attributes: ["id", "uuid", "name"],
        include: [
          {
            association: "project",
            attributes: ["uuid", "name"]
          }
        ]
      },
      { association: "task", attributes: ["uuid"] }
    ]
  },
  [Nursery.LARAVEL_TYPE]: {
    model: Nursery
  },
  [NurseryReport.LARAVEL_TYPE]: {
    model: NurseryReport,
    include: [
      {
        association: "nursery",
        attributes: ["id", "uuid", "name"],
        include: [
          {
            association: "project",
            attributes: ["uuid", "name"]
          }
        ]
      },
      { association: "task", attributes: ["uuid"] }
    ]
  }
};

export type ActionWithTarget = {
  action: Action;
  target: ActionTarget;
  targetableType: EntityType | null;
};

@Injectable()
export class ActionsService {
  async getActions(userId: number): Promise<ActionWithTarget[]> {
    const user = await User.findOne({
      where: { id: userId },
      include: [{ association: "projects", attributes: ["id"] }]
    });

    if (user == null) {
      throw new BadRequestException("User not found");
    }

    const projectIds = user.projects.map(({ id }) => id);

    if (projectIds.length === 0) {
      return [];
    }

    // Pending report statuses that should generate actions
    const pendingReportStatuses = ["due", "started", "needs-more-information", "requires-more-information"];

    const [reportActions, entityActions, additionalReportActions] = await Promise.all([
      Action.withTargetableStatus([ProjectReport, SiteReport, NurseryReport], pendingReportStatuses).findAll({
        where: {
          status: "pending",
          projectId: { [Op.in]: projectIds }
        },
        order: [["updatedAt", "DESC"]],
        limit: 10
      }),
      Action.withTargetableStatus([Project, Site, Nursery], ["needs-more-information", "started"]).findAll({
        where: {
          status: "pending",
          projectId: { [Op.in]: projectIds }
        },
        order: [["updatedAt", "DESC"]],
        limit: 10
      }),
      this.getAdditionalReportActions(projectIds, pendingReportStatuses)
    ]);

    const allActions = [...reportActions, ...entityActions, ...additionalReportActions].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    const seen = new Set<string>();
    const deduplicatedActions: Action[] = [];
    const duplicatesToDelete: Action[] = [];
    for (const action of allActions) {
      const key = `${action.targetableType}|${action.targetableId}`;
      if (seen.has(key)) {
        duplicatesToDelete.push(action);
      } else {
        seen.add(key);
        deduplicatedActions.push(action);
      }
    }

    if (duplicatesToDelete.length > 0) {
      const duplicateIds = duplicatesToDelete.map(a => a.id);
      await Action.destroy({ where: { id: { [Op.in]: duplicateIds } } });
    }

    return await this.loadTargetablesAndCreateDtos(deduplicatedActions);
  }

  /**
   * Gets actions for site and nursery reports that are pending but belong to tasks
   * where the project report is no longer pending (already submitted/started).
   * This ensures that when a project report is submitted, individual site/nursery
   * reports still show up as actions.
   */
  private async getAdditionalReportActions(projectIds: number[], pendingReportStatuses: string[]): Promise<Action[]> {
    // Find tasks that have project reports that are NOT in pending statuses
    // (meaning they've been submitted/started)
    const tasksWithNonPendingProjectReports = await Task.findAll({
      where: {
        projectId: { [Op.in]: projectIds }
      },
      include: [
        {
          association: "projectReport",
          required: true,
          where: {
            status: { [Op.notIn]: pendingReportStatuses }
          },
          attributes: ["id", "taskId", "projectId", "status"]
        }
      ],
      attributes: ["id", "projectId"]
    });

    if (tasksWithNonPendingProjectReports.length === 0) {
      return [];
    }

    const taskIds = tasksWithNonPendingProjectReports.map(task => task.id);
    const taskProjectMap = new Map(tasksWithNonPendingProjectReports.map(task => [task.id, task.projectId]));

    // Find site and nursery reports for these tasks that are in pending statuses
    const [pendingSiteReports, pendingNurseryReports] = await Promise.all([
      SiteReport.findAll({
        where: {
          taskId: { [Op.in]: taskIds },
          status: { [Op.in]: pendingReportStatuses }
        },
        attributes: ["id", "taskId", "projectId", "status"]
      }),
      NurseryReport.findAll({
        where: {
          taskId: { [Op.in]: taskIds },
          status: { [Op.in]: pendingReportStatuses }
        },
        attributes: ["id", "taskId", "projectId", "status"]
      })
    ]);

    // Get existing actions for these reports to avoid duplicates
    const existingActions = await Action.findAll({
      where: {
        [Op.or]: [
          {
            targetableType: SiteReport.LARAVEL_TYPE,
            targetableId: { [Op.in]: pendingSiteReports.map(r => r.id) }
          },
          {
            targetableType: NurseryReport.LARAVEL_TYPE,
            targetableId: { [Op.in]: pendingNurseryReports.map(r => r.id) }
          }
        ],
        status: "pending"
      },
      attributes: ["targetableType", "targetableId"]
    });

    const existingActionKeys = new Set(existingActions.map(a => `${a.targetableType}|${a.targetableId}`));

    // Get project and organisation IDs for creating actions
    const projectIdsForReports = [
      ...new Set([...pendingSiteReports.map(r => r.projectId), ...pendingNurseryReports.map(r => r.projectId)])
    ].filter((id): id is number => id != null);

    const projects = await Project.findAll({
      where: { id: { [Op.in]: projectIdsForReports } },
      attributes: ["id", "organisationId"]
    });

    const projectOrgMap = new Map(projects.map(p => [p.id, p.organisationId]));

    // Create actions for reports that don't have them yet
    const actionsToCreate: Array<{
      targetableType: string;
      targetableId: number;
      projectId: number | null;
      organisationId: number | null;
    }> = [];

    for (const siteReport of pendingSiteReports) {
      const key = `${SiteReport.LARAVEL_TYPE}|${siteReport.id}`;
      if (!existingActionKeys.has(key) && siteReport.projectId != null) {
        actionsToCreate.push({
          targetableType: SiteReport.LARAVEL_TYPE,
          targetableId: siteReport.id,
          projectId: siteReport.projectId,
          organisationId: projectOrgMap.get(siteReport.projectId) ?? null
        });
      }
    }

    for (const nurseryReport of pendingNurseryReports) {
      const key = `${NurseryReport.LARAVEL_TYPE}|${nurseryReport.id}`;
      if (!existingActionKeys.has(key) && nurseryReport.projectId != null) {
        actionsToCreate.push({
          targetableType: NurseryReport.LARAVEL_TYPE,
          targetableId: nurseryReport.id,
          projectId: nurseryReport.projectId,
          organisationId: projectOrgMap.get(nurseryReport.projectId) ?? null
        });
      }
    }

    if (actionsToCreate.length === 0) {
      return [];
    }

    // Bulk create actions
    const createdActions = await Action.bulkCreate(
      actionsToCreate.map(
        ({ targetableType, targetableId, projectId, organisationId }) =>
          ({
            status: "pending",
            targetableType,
            targetableId,
            type: "notification",
            projectId,
            organisationId
          } as Action)
      ),
      { returning: true }
    );

    return createdActions;
  }

  private async loadTargetablesAndCreateDtos(actions: Action[]): Promise<ActionWithTarget[]> {
    if (actions.length === 0) {
      return [];
    }

    const actionsByType = groupBy(actions, "targetableType");
    const targetablesMap = new Map<string, EntityModel>();

    await Promise.all(
      Object.entries(actionsByType).map(async ([laravelType, typeActions]) => {
        const loader = TARGETABLE_LOADERS[laravelType];
        if (loader == null) {
          return;
        }

        const ids = [...new Set(typeActions.map(a => a.targetableId))];
        if (ids.length === 0) return;

        const models = await loader.model.findAll({
          where: { id: { [Op.in]: ids } },
          ...(loader.include != null && { include: loader.include })
        });

        for (const model of models) {
          targetablesMap.set(`${laravelType}|${model.id}`, model);
        }
      })
    );

    return actions.map(action => {
      const targetKey = `${action.targetableType}|${action.targetableId}`;
      const targetModel = targetablesMap.get(targetKey);
      const target = this.createTargetForAction(action, targetModel);
      const targetableType = this.getEntityTypeFromModel(targetModel);
      return { action, target, targetableType };
    });
  }

  private createTargetForAction(action: Action, targetModel?: EntityModel): ActionTarget {
    if (targetModel != null) {
      return targetModel as ActionTarget;
    }

    const entityType = this.getEntityTypeFromModel(targetModel);
    if (entityType != null) {
      return entityType;
    }

    return "projects";
  }

  private getEntityTypeFromModel(targetModel?: EntityModel): EntityType | null {
    if (targetModel == null) return null;
    return formModelType(targetModel) as EntityType | null;
  }
}
