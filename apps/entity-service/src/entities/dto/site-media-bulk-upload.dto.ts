import { ApiProperty } from "@nestjs/swagger";
import { MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { IsString, IsUUID } from "class-validator";

export class SiteMediaBulkUploadDto {
  @IsUUID()
  @ApiProperty({ description: "Entity type to upload media to" })
  entity: MediaOwnerType;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID to upload media to" })
  uuid: string;

  @IsString()
  @ApiProperty({ description: "Collection to upload media to" })
  collection: string;
}
