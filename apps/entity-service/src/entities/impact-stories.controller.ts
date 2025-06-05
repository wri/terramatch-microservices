import { BadRequestException, Controller, Get, HttpStatus, NotFoundException, Param, Query } from "@nestjs/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import { ImpactStoryService } from "./impact-story.service";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { ImpactStoryParamDto } from "./dto/impact-story-param.dto";
import { ImpactStoryFullDto, ImpactStoryLightDto, ImpactStoryMedia } from "./dto/impact-story.dto";
import { EntitiesService } from "./entities.service";
import { ImpactStory, Media, Organisation, WorldCountryGeneralized } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

@Controller("entities/v3/impactStories")
export class ImpactStoriesController {
  constructor(
    private readonly impactStoryService: ImpactStoryService,
    private readonly policyService: PolicyService,
    private readonly entitiesService: EntitiesService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "impactStoryIndex",
    summary: "Get impact stories."
  })
  @JsonApiResponse([{ data: ImpactStoryLightDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async impactStoryIndex(@Query() params: ImpactStoryQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.impactStoryService.getImpactStories(params);
    const document = buildJsonApi(ImpactStoryLightDto, { pagination: "number" });
    const indexIds: string[] = [];
    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const impact of data) {
        if (typeof impact.category === "string") {
          impact.category = JSON.parse(impact.category);
        }
        indexIds.push(impact.uuid);
        const organization = await buildOrganizationLight(impact.organisation, false);
        const mediaCollection = await Media.for(impact).findAll();
        const impactDto = new ImpactStoryLightDto(impact, {
          organization,
          ...(this.entitiesService.mapMediaCollection(
            mediaCollection,
            ImpactStory.MEDIA,
            "siteReports",
            impact.uuid
          ) as ImpactStoryMedia)
        });
        document.addData(impactDto.uuid, impactDto);
      }
    }
    document.addIndexData({
      resource: "impactStories",
      requestPath: `/entities/v3/impactStories${getStableRequestQuery(params)}`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
    return document.serialize();
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "impactStoryGet",
    summary: "Get an impact story by uuid."
  })
  @JsonApiResponse(ImpactStoryFullDto, { status: HttpStatus.OK })
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Project pitch not found" })
  async impactStoryGet(@Param() { uuid }: ImpactStoryParamDto) {
    const impactStory = await this.impactStoryService.getImpactStory(uuid);
    const mediaCollection = await Media.for(impactStory).findAll();
    const organization = await buildOrganizationLight(impactStory.organisation, true);
    await this.policyService.authorize("read", impactStory);
    if (typeof impactStory.category === "string") {
      impactStory.category = JSON.parse(impactStory.category);
    }
    return buildJsonApi(ImpactStoryFullDto)
      .addData(
        uuid,
        new ImpactStoryFullDto(impactStory, {
          organization,
          ...(this.entitiesService.mapMediaCollection(
            mediaCollection,
            ImpactStory.MEDIA,
            "siteReports",
            impactStory.uuid
          ) as ImpactStoryMedia)
        })
      )
      .document.serialize();
  }
}

export async function buildOrganizationLight(organisation: Organisation, FullDto: boolean) {
  if (organisation?.countries?.length == 0) return null;

  let countries;
  let liteAttrib: object = {};
  if (Array.isArray(organisation.countries) && organisation.countries.length > 0) {
    countries = await WorldCountryGeneralized.findAll({
      where: {
        iso: {
          [Op.in]: organisation.countries
        }
      }
    });
  }

  if (FullDto) {
    liteAttrib = {
      uuid: organisation.uuid,
      webUrl: organisation.webUrl,
      facebookUrl: organisation.facebookUrl,
      instagramUrl: organisation.instagramUrl,
      linkedinUrl: organisation.linkedinUrl,
      twitterUrl: organisation.twitterUrl
    };
  }
  return {
    ...liteAttrib,
    name: organisation.name,
    countries: countries?.map(country => ({
      label: country.country ?? null,
      icon:
        typeof country.iso === "string" && country.iso.trim() !== "" ? `/flags/${country.iso.toLowerCase()}.svg` : null
    }))
  };
}
