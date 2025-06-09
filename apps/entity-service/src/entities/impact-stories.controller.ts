import { BadRequestException, Controller, Get, HttpStatus, NotFoundException, Param, Query } from "@nestjs/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ImpactStoryService } from "./impact-story.service";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { ImpactStoryParamDto } from "./dto/impact-story-param.dto";
import { ImpactStoryFullDto, ImpactStoryLightDto, ImpactStoryMedia } from "./dto/impact-story.dto";
import { EntitiesService } from "./entities.service";
import { ImpactStory, Media } from "@terramatch-microservices/database/entities";

@Controller("entities/v3/impactStories")
export class ImpactStoriesController {
  constructor(
    private readonly impactStoryService: ImpactStoryService,
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
      const mediaByStory = await this.impactStoryService.getMediaForStories(data);

      const organizationCountries = data.map(story => story.organisation?.countries ?? []);
      const countriesMap = await this.impactStoryService.getCountriesForOrganizations(organizationCountries);

      for (const impact of data) {
        if (typeof impact.category === "string") {
          impact.category = JSON.parse(impact.category);
        }
        indexIds.push(impact.uuid);

        const mediaCollection = mediaByStory[impact.id] ?? [];
        const orgCountries = (impact.organisation?.countries ?? []).map(iso => countriesMap.get(iso)).filter(Boolean);
        const organization = {
          name: impact.organisation?.name,
          uuid: impact.organisation?.uuid,
          type: impact.organisation?.type,
          countries: orgCountries
        };

        const impactDto = new ImpactStoryLightDto(impact, {
          organization,
          ...(this.entitiesService.mapMediaCollection(
            mediaCollection,
            ImpactStory.MEDIA,
            "projects",
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
  @ExceptionResponse(NotFoundException, { description: "Impact story not found" })
  async impactStoryGet(@Param() { uuid }: ImpactStoryParamDto) {
    const impactStory = await this.impactStoryService.getImpactStory(uuid);

    const mediaCollection = await Media.for(impactStory).findAll();

    const organizationCountries = impactStory.organisation?.countries ?? [];
    const countriesMap = await this.impactStoryService.getCountriesForOrganizations([organizationCountries]);
    const orgCountries = organizationCountries.map(iso => countriesMap.get(iso)).filter(Boolean);

    if (typeof impactStory.category === "string") {
      impactStory.category = JSON.parse(impactStory.category);
    }

    const organization = {
      uuid: impactStory.organisation?.uuid,
      name: impactStory.organisation?.name,
      type: impactStory.organisation?.type,
      countries: orgCountries,
      webUrl: impactStory.organisation?.webUrl,
      facebookUrl: impactStory.organisation?.facebookUrl,
      instagramUrl: impactStory.organisation?.instagramUrl,
      linkedinUrl: impactStory.organisation?.linkedinUrl,
      twitterUrl: impactStory.organisation?.twitterUrl
    };

    return buildJsonApi(ImpactStoryFullDto)
      .addData(
        uuid,
        new ImpactStoryFullDto(impactStory, {
          organization,
          ...(this.entitiesService.mapMediaCollection(
            mediaCollection,
            ImpactStory.MEDIA,
            "projects",
            impactStory.uuid
          ) as ImpactStoryMedia)
        })
      )
      .document.serialize();
  }
}
