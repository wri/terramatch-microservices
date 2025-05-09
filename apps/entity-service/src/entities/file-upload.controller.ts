import { Controller, Post, Param, Body } from "@nestjs/common";

@Controller("entities/v3/file/upload/:collection/:entity/:uuid")
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post()
  async uploadFile(
    @Param("collection") collection: string,
    @Param("entity") entity: string,
    @Param("uuid") uuid: string,
    @Body() body: any
  ) {
    return this.fileUploadService.uploadFile(collection, entity, uuid, body);
  }
}
