import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityProcessor } from "./entity-processor";
import { Site } from "@terramatch-microservices/database/entities";

export class SiteProcessor extends EntityProcessor<Site> {
  readonly MODEL = Site;

  addFullDto(document: DocumentBuilder, model: Site): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
