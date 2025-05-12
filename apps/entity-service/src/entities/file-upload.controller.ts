import { Controller, Post, Param, NotFoundException, Req } from "@nestjs/common";
import { FileUploadService } from "../trees/file-upload.service";
import { EntitiesService } from "./entities.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { SpecificEntityDto } from "./dto/specific-entity.dto";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { FastifyRequest } from "fastify";

@Controller("entities/v3/file/upload")
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly entitiesService: EntitiesService,
    private readonly policyService: PolicyService
  ) {}

  @Post(":collection/:entity/:uuid")
  async uploadFile<T extends EntityModel>(
    @Param("collection") collection: string,
    @Param() { entity, uuid }: SpecificEntityDto,
    @Req() req: FastifyRequest
  ) {
    const file = await (req as any).file();
    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();
    await this.policyService.authorize("uploadFiles", model);
    return this.fileUploadService.uploadFile(model, entity, collection, file);
  }
}
