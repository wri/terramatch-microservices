import { BadRequestException, Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { EntitiesService } from "./entities.service";
import { MediaProcessor } from "./processors/media.processor";
import { MediaMapIndexParamsDto } from "./dto/media-map-index-params.dto";
import { MediaMapIndexDto } from "./dto/media-map-index.dto";

@Controller("entities/v3/:entity/:uuid/mediaMapIndex")
export class MediaMapIndexController {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "mediaMapIndex",
    summary: "Get a sparse list of every geotagged media in scope for an entity, for map display.",
    description: `Covers the same media as the entity's media association index (a project includes its sites,
      nurseries and reports). Not paginated by design: map markers need the complete set in one response, and
      each entry only carries the few attributes the map needs. Use the media association index for galleries.`
  })
  @JsonApiResponse(MediaMapIndexDto)
  @ExceptionResponse(BadRequestException, { description: "Unsupported entity type or invalid uuid." })
  @ExceptionResponse(NotFoundException, { description: "Base entity not found." })
  @ExceptionResponse(UnauthorizedException, { description: "Current user is not authorized to read this entity." })
  async mediaMapIndex(@Param() { entity, uuid }: MediaMapIndexParamsDto) {
    const processor = this.entitiesService.createAssociationProcessor(entity, uuid, "media") as MediaProcessor;
    await this.policyService.authorize("read", await processor.getBaseEntity());

    const media = await processor.getMapIndex();
    return buildJsonApi(MediaMapIndexDto).addData(`${entity}|${uuid}`, new MediaMapIndexDto(media));
  }
}
