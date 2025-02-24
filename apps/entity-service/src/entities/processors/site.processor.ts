import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { Nursery, ProjectReport, Site } from "@terramatch-microservices/database/entities";
import { AdditionalSiteFullProps, SiteFullDto, SiteLightDto } from "../dto/site.dto";

export class SiteProcessor extends EntityProcessor<Site, SiteLightDto, SiteFullDto> {
  readonly LIGHT_DTO = SiteLightDto;
  readonly FULL_DTO = SiteFullDto;

  async findOne(uuid: string): Promise<Site> {
    return await Site.findOne({
      where: { uuid },
      include: [{ association: "framework" }]
    });
  }

  async findMany(): Promise<PaginatedResult<Site>> {
    throw new Error("Method not implemented.");
  }

  async addFullDto(document: DocumentBuilder, site: Site): Promise<void> {
    const siteId = site.id;

    const props: AdditionalSiteFullProps = {
      totalSiteReports: 0
    };

    document.addData(site.uuid, new SiteFullDto(site, props));
  }

  async addLightDto(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
