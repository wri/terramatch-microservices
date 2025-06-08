import {
  Controller,
  Post,
  Param,
  NotFoundException,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  InternalServerErrorException
} from "@nestjs/common";
import { ExtractedRequestData, FileUploadService } from "../file/file-upload.service";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators/exception-response.decorator";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { MediaDto } from "./dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { MEDIA_OWNER_MODELS } from "@terramatch-microservices/database/constants/media-owners";
import "multer";

@Controller("entities/v3/files")
@ApiExtraModels(MediaDto)
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly policyService: PolicyService,
    private readonly mediaService: MediaService
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
  @ExceptionResponse(BadRequestException, { description: "Invalid request." })
  @ExceptionResponse(InternalServerErrorException, { description: "Internal server error." })
  @UseInterceptors(FileInterceptor("uploadFile"))
  async uploadFile(
    @Param() { collection, entity, uuid }: MediaCollectionEntityDto,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ExtractedRequestData
  ) {
    const mediaOwnerClass = MEDIA_OWNER_MODELS[entity];
    const model = await mediaOwnerClass.findOne({ where: { uuid }, attributes: ["id", "frameworkKey"] });
    if (model == null) throw new NotFoundException();
    await this.policyService.authorize("uploadFiles", model);
    const media = await this.fileUploadService.uploadFile(model, entity, collection, file, body);
    const document = buildJsonApi(MediaDto);
    document.addData(
      media.uuid,
      new MediaDto(media, {
        url: this.mediaService.getUrl(media),
        thumbUrl: this.mediaService.getUrl(media, "thumbnail"),
        entityType: entity,
        entityUuid: model.uuid
      })
    );
    return document.serialize();
  }
}
