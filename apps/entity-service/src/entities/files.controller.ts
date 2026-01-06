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
import { SiteMediaBulkUploadDto } from "./dto/site-media-bulk-upload.dto";
import { Site } from "@terramatch-microservices/database/entities/site.entity";
import { MediaRequestBulkBody } from "./dto/media-request-bulk.dto";
import { MediaBulkResponseDto } from "./dto/media-bulk-response.dto";
import { Media } from "@terramatch-microservices/database/entities/media.entity";

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

  @Post("/site/:siteUuid/bulkUpload")
  @ApiOperation({
    operationId: "siteMediaBulkUpload",
    summary: "Upload multiple files to a site photos collection",
    description: "Upload multiple files to a site photos collection"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or site unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Site not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  @JsonApiResponse([MediaDto, MediaBulkResponseDto])
  async siteMediaBulkUpload(@Param() { siteUuid }: SiteMediaBulkUploadDto, @Body() payload: MediaRequestBulkBody) {
    const site = await Site.findOne({ where: { uuid: siteUuid } });
    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }
    await this.policyService.authorize("uploadFiles", site);
    const errors: MediaBulkResponseDto[] = [];
    const createdMedias: Media[] = [];
    await this.fileUploadService.transaction(async transaction => {
      for (const [index, payloadData] of payload.data.entries()) {
        let file: Express.Multer.File;
        try {
          file = await this.fileUploadService.fetchDataFromUrlAsMulterFile(payloadData.attributes.downloadUrl);
          const media = await this.fileUploadService.uploadFile(
            site,
            "sites",
            "photos",
            file,
            payloadData.attributes,
            transaction
          );
          createdMedias.push(media);
        } catch (error) {
          errors.push(new MediaBulkResponseDto(index, error.message));
        }
      }
      if (errors.length > 0) {
        // clear s3 files
        for (const media of createdMedias) {
          await this.mediaService.deleteMediaFromS3(media);
        }
        throw new BadRequestException("Failed to upload some files");
      }
    });
    let document;
    if (errors.length > 0) {
      document = buildJsonApi(MediaBulkResponseDto);
      for (const error of errors) {
        document.addData(error.index.toString(), new MediaBulkResponseDto(error.index, error.error));
      }
    } else {
      document = buildJsonApi(MediaDto);
      for (const media of createdMedias) {
        document.addData(
          media.uuid,
          new MediaDto(media, {
            url: this.mediaService.getUrl(media),
            thumbUrl: this.mediaService.getUrl(media, "thumbnail"),
            entityType: "sites",
            entityUuid: site.uuid
          })
        );
      }
    }
    return document;
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
    data: MediaDto,
    included: [MediaDto]
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  async mediaUpdate(@Param() { uuid }: SingleMediaDto, @Body() updatePayload: MediaUpdateBody) {
    const media = await this.mediaService.getMedia(uuid);
    const model = await getBaseEntityByLaravelTypeAndId(media.modelType, media.modelId);
    await this.policyService.authorize("updateFiles", model);
    const updatedMedia = await this.mediaService.updateMedia(media, updatePayload);

    const document = buildJsonApi(MediaDto);
    document.addData(
      updatedMedia.uuid,
      new MediaDto(updatedMedia, {
        url: this.mediaService.getUrl(updatedMedia),
        thumbUrl: this.mediaService.getUrl(updatedMedia, "thumbnail"),
        entityType: updatedMedia.modelType as EntityType,
        entityUuid: model.uuid
      })
    );

    if (updatePayload.data.attributes.isCover != null && updatePayload.data.attributes.isCover === true) {
      const project = await this.mediaService.getProjectForModel(model);
      await this.policyService.authorize("read", project);
      const updatedMedias = await this.mediaService.unsetMediaCoverForProject(updatedMedia, project);
      for (const media of updatedMedias) {
        document.addData(
          media.uuid,
          new MediaDto(media, {
            url: this.mediaService.getUrl(media),
            thumbUrl: this.mediaService.getUrl(media, "thumbnail"),
            entityType: media.modelType as EntityType,
            entityUuid: model.uuid
          }),
          true
        );
      }
    }

    return document;
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
