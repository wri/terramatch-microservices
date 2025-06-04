import {
  Controller,
  Post,
  Param,
  NotFoundException,
  Req,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  Body
} from "@nestjs/common";
import { ExtractedRequestData, FileUploadService } from "../file/file-upload.service";
import { EntitiesService } from "./entities.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators/exception-response.decorator";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import "multer";

@Controller("entities/v3/files")
@ApiExtraModels(MediaCollectionEntityDto)
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService
  ) {}

  @Post("/:collection/:entity/:uuid")
  @ApiOperation({
    operationId: "uploadFile",
    summary: "Upload a file to a media collection",
    description: "Upload a file to a media collection"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile<T extends EntityModel>(
    @Param() { collection, entity, uuid }: MediaCollectionEntityDto,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ExtractedRequestData
  ) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();
    await this.policyService.authorize("uploadFiles", model);
    return this.fileUploadService.uploadFile(model, entity, collection, file, body);
  }
}
