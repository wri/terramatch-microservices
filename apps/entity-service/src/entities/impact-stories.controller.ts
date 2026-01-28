import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import {
  buildJsonApi,
  getStableRequestQuery,
  buildDeletedResponse,
  getDtoType
} from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { ImpactStoryService } from "./impact-story.service";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { ImpactStoryParamDto } from "./dto/impact-story-param.dto";
import { ImpactStoryFullDto, ImpactStoryLightDto, ImpactStoryMedia } from "./dto/impact-story.dto";
import { EntitiesService } from "./entities.service";
import { ImpactStory } from "@terramatch-microservices/database/entities";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { PolicyService } from "@terramatch-microservices/common";
import { CreateImpactStoryBody } from "./dto/create-impact-story.dto";
import { UpdateImpactStoryBody } from "./dto/update-impact-story.dto";
import { ImpactStoryBulkDeleteBodyDto } from "./dto/bulk-delete-impact-stories.dto";

@Controller("entities/v3/impactStories")
export class ImpactStoriesController {
  constructor(
    private readonly impactStoryService: ImpactStoryService,
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @NoBearerAuth
  @ApiOperation({
    operationId: "impactStoryIndex",
    summary: "Get impact stories."
  })
  @JsonApiResponse([{ data: ImpactStoryLightDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  async impactStoryIndex(@Query() params: ImpactStoryQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.impactStoryService.getImpactStories(params);
    const document = buildJsonApi(ImpactStoryLightDto, { pagination: "number" });

    if (data.length !== 0) {
      const mediaByStory = await this.impactStoryService.getMediaForStories(data);

      const organizationCountries = data.map(story => story.organisation?.countries ?? []);
      const countriesMap = await this.impactStoryService.getCountriesForOrganizations(organizationCountries);

      for (const impact of data) {
        const mediaCollection = mediaByStory[impact.id] ?? [];
        const orgCountries = (impact.organisation?.countries ?? [])
          .map(iso => countriesMap.get(iso))
          .filter(country => country != null);
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

    return document.addIndex({
      requestPath: `/entities/v3/impactStories${getStableRequestQuery(params)}`,
      total: paginationTotal,
      pageNumber: pageNumber
    });
  }

  @Get(":uuid")
  @NoBearerAuth
  @ApiOperation({
    operationId: "impactStoryGet",
    summary: "Get an impact story by uuid."
  })
  @JsonApiResponse(ImpactStoryFullDto)
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Impact story not found" })
  async impactStoryGet(@Param() { uuid }: ImpactStoryParamDto) {
    const { impactStory, mediaCollection, organization } = await this.impactStoryService.getImpactStoryWithMedia(
      uuid,
      true
    );

    return buildJsonApi(ImpactStoryFullDto).addData(
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
    );
  }

  @Post()
  @ApiOperation({
    operationId: "impactStoryCreate",
    summary: "Create a new impact story",
    description: `Create a new impact story for an organization. Requires authentication and appropriate permissions.`
  })
  @JsonApiResponse(ImpactStoryFullDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data or organization not found." })
  async impactStoryCreate(@Body() createRequest: CreateImpactStoryBody) {
    await this.policyService.authorize("create", ImpactStory);

    const impactStory = await this.impactStoryService.createImpactStory(createRequest.data.attributes);

    if (impactStory.uuid == null || impactStory.uuid === "") {
      throw new BadRequestException("Created impact story has invalid UUID");
    }

    const { mediaCollection, organization } = await this.impactStoryService.getImpactStoryWithMedia(
      impactStory.uuid,
      true
    );

    return buildJsonApi(ImpactStoryFullDto).addData(
      impactStory.uuid,
      new ImpactStoryFullDto(impactStory, {
        organization,
        ...(this.entitiesService.mapMediaCollection(
          mediaCollection,
          ImpactStory.MEDIA,
          "projects",
          impactStory.uuid
        ) as ImpactStoryMedia)
      })
    );
  }

  @Patch(":uuid")
  @ApiOperation({
    operationId: "impactStoryUpdate",
    summary: "Update an existing impact story",
    description: `Update an impact story by UUID. Requires authentication and appropriate permissions.
    
    All fields except status are optional. Status is required.`
  })
  @JsonApiResponse(ImpactStoryFullDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Impact story not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async impactStoryUpdate(@Param() { uuid }: ImpactStoryParamDto, @Body() updateRequest: UpdateImpactStoryBody) {
    if (uuid !== updateRequest.data.id) {
      throw new BadRequestException("Impact story UUID in path and payload do not match");
    }

    const impactStory = await this.impactStoryService.getImpactStory(uuid);
    await this.policyService.authorize("update", impactStory);

    const updatedImpactStory = await this.impactStoryService.updateImpactStory(uuid, updateRequest.data.attributes);

    if (updatedImpactStory.uuid == null || updatedImpactStory.uuid === "") {
      throw new BadRequestException("Updated impact story has invalid UUID");
    }

    const { mediaCollection, organization } = await this.impactStoryService.getImpactStoryWithMedia(
      updatedImpactStory.uuid,
      true
    );

    return buildJsonApi(ImpactStoryFullDto).addData(
      updatedImpactStory.uuid,
      new ImpactStoryFullDto(updatedImpactStory, {
        organization,
        ...(this.entitiesService.mapMediaCollection(
          mediaCollection,
          ImpactStory.MEDIA,
          "projects",
          updatedImpactStory.uuid
        ) as ImpactStoryMedia)
      })
    );
  }

  @Delete("bulkDelete")
  @ApiOperation({
    operationId: "impactStoryBulkDelete",
    summary: "Bulk delete multiple impact stories",
    description: `Bulk delete multiple impact stories by UUIDs. Requires admin permissions.`
  })
  @JsonApiDeletedResponse(getDtoType(ImpactStoryFullDto), {
    description: "Impact stories were deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed or insufficient permissions." })
  @ExceptionResponse(NotFoundException, { description: "One or more impact stories not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request body or empty UUID list." })
  async impactStoryBulkDelete(@Body() deletePayload: ImpactStoryBulkDeleteBodyDto) {
    const permissions = await this.policyService.getPermissions();
    const frameworks = permissions.filter((p: string) => p.startsWith("framework-"));

    if (frameworks.length === 0) {
      throw new UnauthorizedException("Bulk delete requires administrator permissions");
    }

    const uuids = deletePayload.data.map(item => item.id).filter((id): id is string => id != null && id !== "");

    const deletedUuids = await this.impactStoryService.bulkDeleteImpactStories(uuids);

    return buildDeletedResponse(getDtoType(ImpactStoryFullDto), deletedUuids);
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "impactStoryDelete",
    summary: "Soft delete an impact story",
    description: "Soft deletes an impact story by UUID. Requires authentication and appropriate permissions."
  })
  @JsonApiDeletedResponse(getDtoType(ImpactStoryFullDto), {
    description: "Impact story was deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Impact story not found." })
  async impactStoryDelete(@Param() { uuid }: ImpactStoryParamDto) {
    const impactStory = await this.impactStoryService.getImpactStory(uuid);
    await this.policyService.authorize("delete", impactStory);

    await this.impactStoryService.deleteImpactStory(uuid);

    return buildDeletedResponse(getDtoType(ImpactStoryFullDto), uuid);
  }
}
