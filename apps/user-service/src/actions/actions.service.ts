import { BadRequestException, Injectable } from "@nestjs/common";
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

    const [reportActions, entityActions] = await Promise.all([
      Action.withTargetableStatus(
        [ProjectReport, SiteReport, NurseryReport],
        ["needs-more-information", "due"]
      ).findAll({
        where: {
          status: "pending",
          projectId: { [Op.in]: projectIds }
        },
        order: [["updatedAt", "DESC"]],
        limit: 10
      }),
      Action.withTargetableStatus([Project, Site, Nursery], ["needs-more-information"]).findAll({
        where: {
          status: "pending",
          projectId: { [Op.in]: projectIds }
        },
        order: [["updatedAt", "DESC"]],
        limit: 10
      })
    ]);

    const allActions = [...reportActions, ...entityActions].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    return await this.loadTargetablesAndCreateDtos(allActions);
  }

  private async loadTargetablesAndCreateDtos(actions: Action[]): Promise<ActionWithTarget[]> {
    if (actions.length === 0) {
      return [];
    }

    const actionsByType = groupBy(actions, "targetableType");
    const targetablesMap = new Map<number, EntityModel>();

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
          targetablesMap.set(model.id, model);
        }
      })
    );

    return actions.map(action => {
      const targetModel = targetablesMap.get(action.targetableId);
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
    // formModelType devuelve un FormModelType; en este contexto sólo usamos entity/report models
    return formModelType(targetModel) as EntityType | null;
  }
}
