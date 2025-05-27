import { Controller, Post, Param, NotFoundException, Req } from "@nestjs/common";
import { FileUploadService } from "../file/file-upload.service";
import { EntitiesService } from "./entities.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { FastifyRequest } from "fastify";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";

@Controller("entities/v3/files")
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService
  ) {}

  @Post("/:collection/:entity/:uuid")
  async uploadFile<T extends EntityModel>(
    @Param() { collection, entity, uuid }: MediaCollectionEntityDto,
    @Req() req: FastifyRequest
  ) {
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();
    await this.policyService.authorize("uploadFiles", model);
    return this.fileUploadService.uploadFile(model, entity, collection, req);
  }
}
