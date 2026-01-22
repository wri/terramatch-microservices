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

const reportLaravelTypes = [ProjectReport.LARAVEL_TYPE, SiteReport.LARAVEL_TYPE, NurseryReport.LARAVEL_TYPE];

const entityLaravelTypes = [Project.LARAVEL_TYPE, Site.LARAVEL_TYPE, Nursery.LARAVEL_TYPE];

export type ActionWithTarget = {
  action: Action;
  target: ActionTarget;
  targetableType: EntityType | null;
};

@Injectable()
export class ActionsService {
  async getActions(
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

    const [reportActions, entityActions] = await Promise.all([
      Action.withTargetableStatus().findAll({
        where: {
          status: "pending",
          projectId: { [Op.in]: projectIds },
          targetableType: { [Op.in]: reportLaravelTypes }
        },
        order: [["updatedAt", "DESC"]],
        limit: 10
      }),
      Action.withTargetableStatus().findAll({
        where: {
          status: "pending",
          projectId: { [Op.in]: projectIds },
          targetableType: { [Op.in]: entityLaravelTypes }
        },
        order: [["updatedAt", "DESC"]],
        limit: 10
      })
    ]);

    const allActions = [...reportActions, ...entityActions].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

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
      const targetableType = this.laravelTypeToEntityType(action.targetableType);
      return { action, target, targetableType };
    });
  }

  private createTargetForAction(action: Action, targetModel?: EntityModel): ActionTarget {
    if (targetModel != null) {
      return targetModel as ActionTarget;
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
