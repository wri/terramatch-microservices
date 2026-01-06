import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class SiteMediaBulkUploadDto {
  @IsUUID()
  @ApiProperty({ description: "Site UUID to upload media to" })
  siteUuid: string;
}
