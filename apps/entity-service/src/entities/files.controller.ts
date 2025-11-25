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
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileUploadService } from "../file/file-upload.service";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApiOperation } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { buildDeletedResponse, buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { MediaDto } from "./dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "./entities.service";
import "multer";
import { MediaRequestBody } from "./dto/media-request.dto";
import { TranslatableException } from "@terramatch-microservices/common/exceptions/translatable.exception";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { getBaseEntityByLaravelTypeAndId } from "./processors/media-owner-processor";
import { MediaUpdateBody } from "@terramatch-microservices/common/dto/media-update.dto";
import { SingleMediaDto } from "./dto/media-query.dto";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

@Controller("entities/v3/files")
export class FilesController {
  private logger = new TMLogger(FilesController.name);

  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly policyService: PolicyService,
    private readonly mediaService: MediaService,
    private readonly entitiesService: EntitiesService
  ) {}

  @Get(":uuid")
  @ApiOperation({
    operationId: "getMedia",
    summary: "Get a media by uuid"
  })
  @JsonApiResponse({ data: MediaDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async getMedia(@Param() { uuid }: SingleMediaDto) {
    const media = await this.mediaService.getMedia(uuid);
    const model = await getBaseEntityByLaravelTypeAndId(media.modelType, media.modelId);
    await this.policyService.authorize("read", media);
    return this.entitiesService.mediaDto(media, { entityType: media.modelType as EntityType, entityUuid: model.uuid });
  }

  @Post("/:entity/:uuid/:collection")
  @ApiOperation({
    operationId: "uploadFile",
    summary: "Upload a file to a media collection",
    description: "Upload a file to a media collection"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(TranslatableException, { description: "Invalid request." })
  @UseInterceptors(FileInterceptor("uploadFile"), FormDtoInterceptor)
  @JsonApiResponse(MediaDto)
  async uploadFile(
    @Param() { collection, entity, uuid }: MediaCollectionEntityDto,
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: MediaRequestBody
  ) {
    const mediaOwnerProcessor = this.entitiesService.createMediaOwnerProcessor(entity, uuid);
    const model = await mediaOwnerProcessor.getBaseEntity();
    await this.policyService.authorize("uploadFiles", model);
    const media = await this.fileUploadService.uploadFile(model, entity, collection, file, payload.data.attributes);
    return buildJsonApi(MediaDto).addData(
      media.uuid,
      new MediaDto(media, {
        url: this.mediaService.getUrl(media),
        thumbUrl: this.mediaService.getUrl(media, "thumbnail"),
        entityType: entity,
        entityUuid: model.uuid
      })
    );
  }

  @Patch(":uuid")
  @ApiOperation({
    operationId: "mediaUpdate",
    summary: "Update a media by uuid"
  })
  @JsonApiResponse({
    data: MediaDto
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  async mediaUpdate(@Param() { uuid }: SingleMediaDto, @Body() updatePayload: MediaUpdateBody) {
    const media = await this.mediaService.getMedia(uuid);
    const model = await getBaseEntityByLaravelTypeAndId(media.modelType, media.modelId);
    await this.policyService.authorize("updateFiles", model);
    if (updatePayload.data.attributes.isCover != null && updatePayload.data.attributes.isCover === true) {
      const project = await this.mediaService.getProjectForModel(model);
      await this.policyService.authorize("read", project);
      await this.mediaService.updateCover(media, project);
    }
    return await this.mediaService.updateMedia(media, updatePayload);
  }

  @Delete("bulkDelete")
  @ApiOperation({
    operationId: "mediaBulkDelete",
    summary: "Delete multiple media"
  })
  @JsonApiResponse({ data: MediaDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  async mediaBulkDelete(@Query() { uuids }: { uuids: string[] }) {
    this.logger.debug("Bulk deleting media with uuids: " + uuids);
    const medias = await this.mediaService.getMedias(uuids);
    await this.policyService.authorize("bulkDelete", medias);
    await Promise.all(medias.map(media => this.mediaService.deleteMedia(media)));
    return buildDeletedResponse("media", uuids);
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "mediaDelete",
    summary: "Delete a media by uuid"
  })
  @JsonApiResponse({ data: MediaDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async mediaDelete(@Param() { uuid }: { uuid: string }) {
    this.logger.debug(`Deleting media ${uuid}`);
    const media = await this.mediaService.getMedia(uuid);
    const model = await getBaseEntityByLaravelTypeAndId(media.modelType, media.modelId);
    await this.policyService.authorize("deleteFiles", model);
    await this.mediaService.deleteMediaByUuid(uuid);
    return buildDeletedResponse("media", uuid);
  }
}
