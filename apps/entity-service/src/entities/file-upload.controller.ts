import { Controller, Post, Param, NotFoundException, Req } from "@nestjs/common";
import { FileUploadService } from "../trees/file-upload.service";
import { EntitiesService } from "./entities.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { SpecificEntityDto } from "./dto/specific-entity.dto";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { FastifyRequest } from "fastify";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { MediaExtraProperties } from "./dto/media-extra-properties";

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
    const parts = req.parts();
    const extraFields: MediaExtraProperties = {
      isPublic: false,
      lat: 0,
      lng: 0
    };
    let file: any;

    // TODO: add typing
    for await (const part of parts) {
      // @ts-ignore
      if (part.file) {
        // @ts-ignore
        file = part;
      } else {
        // @ts-ignore
        extraFields[part.fieldname] = part.value;
      }
    }
    console.log(extraFields);

    const processor = this.entitiesService.createEntityProcessor<T>(entity);
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();
    await this.policyService.authorize("uploadFiles", model);
    return this.fileUploadService.uploadFile(model, entity, collection, file, extraFields);
  }
}
