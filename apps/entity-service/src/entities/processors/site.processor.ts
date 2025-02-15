import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityProcessor } from "./entity-processor";
import { Site } from "@terramatch-microservices/database/entities";
import { EntityQueryDto } from "../dto/entity-query.dto";

export class SiteProcessor extends EntityProcessor<Site> {
  findOne(uuid: string): Promise<Site> {
    throw new Error("Method not implemented.");
  }

  findMany(query: EntityQueryDto, userId: number, permissions: string[]): Promise<Site[]> {
    throw new Error("Method not implemented.");
  }

  addFullDto(document: DocumentBuilder, model: Site): Promise<void> {
    throw new Error("Method not implemented.");
  }

  addLightDto(document: DocumentBuilder, model: Site): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
