import { Injectable } from "@nestjs/common";
import {
  Action,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  Nursery,
  NurseryReport,
  User
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { groupBy } from "lodash";
import { EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ActionTarget } from "@terramatch-microservices/common/dto/action.dto";

export type ActionWithTarget = {
  action: Action;
  target: ActionTarget;
  targetableType: EntityType | null;
};

@Injectable()
export class ActionsService {
  async getMyActions(
    userId: number,
    query: IndexQueryDto
  ): Promise<{ data: ActionWithTarget[]; paginationTotal: number; pageNumber: number }> {
    const user = await User.findOne({
      where: { id: userId },
      include: [{ association: "projects", attributes: ["id"] }]
    });

    if (user == null) {
      throw new Error("User not found");
    }

    const projectIds = user.projects.map(({ id }) => id);

    if (projectIds.length === 0) {
      return {
        data: [],
        paginationTotal: 0,
        pageNumber: query.page?.number ?? 1
      };
    }

    const statuses = ["needs-more-information", "due"];

    const reportLaravelTypes = [ProjectReport.LARAVEL_TYPE, SiteReport.LARAVEL_TYPE, NurseryReport.LARAVEL_TYPE];

    const entityLaravelTypes = [Project.LARAVEL_TYPE, Site.LARAVEL_TYPE, Nursery.LARAVEL_TYPE];

    const [projectReportIds, siteReportIds, nurseryReportIds] = await Promise.all([
      ProjectReport.findAll({
        where: {
          status: { [Op.in]: statuses },
          projectId: { [Op.in]: projectIds }
        },
        attributes: ["id"]
      }),
      SiteReport.findAll({
        where: {
          status: { [Op.in]: statuses },
          "$site.project.id$": { [Op.in]: projectIds }
        },
        include: [
          {
            association: "site",
            attributes: ["id"],
            include: [
              {
                association: "project",
                attributes: ["id"]
              }
            ]
          }
        ],
        attributes: ["id"]
      }),
      NurseryReport.findAll({
        where: {
          status: { [Op.in]: statuses },
          "$nursery.project.id$": { [Op.in]: projectIds }
        },
        include: [
          {
            association: "nursery",
            attributes: ["id"],
            include: [
              {
                association: "project",
                attributes: ["id"]
              }
            ]
          }
        ],
        attributes: ["id"]
      })
    ]);

    const reportTargetableIds = [
      ...projectReportIds.map(r => r.id),
      ...siteReportIds.map(r => r.id),
      ...nurseryReportIds.map(r => r.id)
    ];

    const [projectIdsWithStatus, siteIds, nurseryIds] = await Promise.all([
      Project.findAll({
        where: {
          status: { [Op.in]: statuses },
          id: { [Op.in]: projectIds }
        },
        attributes: ["id"]
      }),
      Site.findAll({
        where: {
          status: { [Op.in]: statuses },
          projectId: { [Op.in]: projectIds }
        },
        attributes: ["id"]
      }),
      Nursery.findAll({
        where: {
          status: { [Op.in]: statuses },
          projectId: { [Op.in]: projectIds }
        },
        attributes: ["id"]
      })
    ]);

    const entityTargetableIds = [
      ...projectIdsWithStatus.map(p => p.id),
      ...siteIds.map(s => s.id),
      ...nurseryIds.map(n => n.id)
    ];

    const [reportActions, entityActions] = await Promise.all([
      reportTargetableIds.length > 0
        ? Action.findAll({
            where: {
              status: "pending",
              targetableType: { [Op.in]: reportLaravelTypes },
              targetableId: { [Op.in]: reportTargetableIds },
              projectId: { [Op.in]: projectIds }
            },
            order: [["updatedAt", "DESC"]],
            limit: 5
          })
        : Promise.resolve([]),
      entityTargetableIds.length > 0
        ? Action.findAll({
            where: {
              status: "pending",
              targetableType: { [Op.in]: entityLaravelTypes },
              targetableId: { [Op.in]: entityTargetableIds },
              projectId: { [Op.in]: projectIds }
            },
            order: [["updatedAt", "DESC"]],
            limit: 5
          })
        : Promise.resolve([])
    ]);
    const allActions = reportActions.concat(entityActions);

    const pageSize = query.page?.size ?? 50;
    const pageNumber = query.page?.number ?? 1;

    const paginationTotal = allActions.length;

    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedActions = allActions.slice(startIndex, endIndex);

    const data = await this.loadTargetablesAndCreateDtos(paginatedActions);

    return {
      data,
      paginationTotal,
      pageNumber
    };
  }

  private async loadTargetablesAndCreateDtos(actions: Action[]): Promise<ActionWithTarget[]> {
    if (actions.length === 0) {
      return [];
    }

    const actionsByType = groupBy(actions, "targetableType");
    const targetablesMap = new Map<number, { type: string; model: EntityModel }>();

    await Promise.all(
      Object.entries(actionsByType).map(async ([laravelType, typeActions]) => {
        const ids = [...new Set(typeActions.map(a => a.targetableId))];
        if (ids.length === 0) return;

        let models: EntityModel[] = [];

        if (laravelType === Project.LARAVEL_TYPE) {
          models = await Project.findAll({ where: { id: { [Op.in]: ids } } });
        } else if (laravelType === ProjectReport.LARAVEL_TYPE) {
          models = await ProjectReport.findAll({
            where: { id: { [Op.in]: ids } },
            include: [
              { association: "project", attributes: ["uuid", "name"] },
              { association: "task", attributes: ["uuid"] }
            ]
          });
        } else if (laravelType === Site.LARAVEL_TYPE) {
          models = await Site.findAll({ where: { id: { [Op.in]: ids } } });
        } else if (laravelType === SiteReport.LARAVEL_TYPE) {
          models = await SiteReport.findAll({
            where: { id: { [Op.in]: ids } },
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
          });
        } else if (laravelType === Nursery.LARAVEL_TYPE) {
          models = await Nursery.findAll({ where: { id: { [Op.in]: ids } } });
        } else if (laravelType === NurseryReport.LARAVEL_TYPE) {
          models = await NurseryReport.findAll({
            where: { id: { [Op.in]: ids } },
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
          });
        }

        for (const model of models) {
          targetablesMap.set(model.id, { type: laravelType, model });
        }
      })
    );

    return actions.map(action => {
      const targetable = targetablesMap.get(action.targetableId);
      const target = this.createTargetForAction(action, targetable);
      const targetableType = this.laravelTypeToEntityType(action.targetableType);
      return { action, target, targetableType };
    });
  }

  private createTargetForAction(
    action: Action,
    targetable: { type: string; model: EntityModel } | undefined
  ): ActionTarget {
    // Return the model as a plain object (Sequelize models are objects)
    // This is the simplest approach that follows the ActionTarget type (object | EntityType)
    if (targetable != null) {
      return targetable.model.toJSON() as ActionTarget;
    }

    const entityType = this.laravelTypeToEntityType(action.targetableType);
    if (entityType != null) {
      return entityType;
    }

    return "projects";
  }

  private laravelTypeToEntityType(laravelType: string): EntityType | null {
    if (laravelType === Project.LARAVEL_TYPE) return "projects";
    else if (laravelType === Site.LARAVEL_TYPE) return "sites";
    else if (laravelType === Nursery.LARAVEL_TYPE) return "nurseries";
    else if (laravelType === ProjectReport.LARAVEL_TYPE) return "projectReports";
    else if (laravelType === SiteReport.LARAVEL_TYPE) return "siteReports";
    else if (laravelType === NurseryReport.LARAVEL_TYPE) return "nurseryReports";
    return null;
  }
}
