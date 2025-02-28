import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { Site } from "@terramatch-microservices/database/entities";
import { SiteFullDto, SiteLightDto } from "../dto/site.dto";

export class SiteProcessor extends EntityProcessor<Site, SiteLightDto, SiteFullDto> {
  readonly LIGHT_DTO = SiteLightDto;
  readonly FULL_DTO = SiteFullDto;

  async findOne(): Promise<Site> {
    throw new Error("Method not implemented.");
  }

  async findMany(): Promise<PaginatedResult<Site>> {
    throw new Error("Method not implemented.");
  }

  async addFullDto(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async addLightDto(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
