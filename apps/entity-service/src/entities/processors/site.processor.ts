import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { Site } from "@terramatch-microservices/database/entities";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { SiteFullDto, SiteLightDto } from "../dto/site.dto";

export class SiteProcessor extends EntityProcessor<Site, SiteLightDto, SiteFullDto> {
  readonly LIGHT_DTO = SiteLightDto;
  readonly FULL_DTO = SiteFullDto;

  findOne(uuid: string): Promise<Site> {
    throw new Error("Method not implemented.");
  }

  findMany(query: EntityQueryDto, userId: number, permissions: string[]): Promise<PaginatedResult<Site>> {
    throw new Error("Method not implemented.");
  }

  addFullDto(document: DocumentBuilder, model: Site): Promise<void> {
    throw new Error("Method not implemented.");
  }

  addLightDto(document: DocumentBuilder, model: Site): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
