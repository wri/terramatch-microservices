import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApiOperation } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "./entities.service";
import "multer";
import { MediaRequestBody } from "./dto/media-request.dto";
import { TranslatableException } from "@terramatch-microservices/common/exceptions/translatable.exception";

@Controller("entities/v3/files")
export class FileUploadController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly mediaService: MediaService,
    private readonly entitiesService: EntitiesService
  ) {}

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
    const media = await this.mediaService.createMedia(
      model,
      entity,
      this.entitiesService.userId,
      collection,
      file,
      payload.data.attributes
    );
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
}
