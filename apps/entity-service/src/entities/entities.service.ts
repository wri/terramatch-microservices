import { BadRequestException, Injectable } from "@nestjs/common";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import {
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { Dictionary } from "lodash";
import { ModelCtor } from "sequelize-typescript";

type ReportModelType = ProjectReport | SiteReport | NurseryReport;
type EntityModelType = ReportModelType | Project | Site | Nursery;

const ENTITY_MODELS: Dictionary<ModelCtor<EntityModelType>> = {
  projects: Project
};

@Injectable()
export class EntitiesService {
  async getEntity(entity: EntityType, uuid: string) {
    const model = ENTITY_MODELS[entity];
    if (model == null) {
      throw new BadRequestException(`Entity type invalid: ${entity}`);
    }

    // TODO: this code is specific to projects.
    return await model.findOne({ where: { uuid }, include: [{ association: "framework" }] });
  }
}
