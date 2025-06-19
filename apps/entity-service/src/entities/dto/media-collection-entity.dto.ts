import { ApiProperty } from "@nestjs/swagger";
import { MEDIA_OWNER_TYPES, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { IsIn, IsUUID } from "class-validator";

export class MediaCollectionEntityDto {
  @IsIn(MEDIA_OWNER_TYPES)
  @ApiProperty({ enum: MEDIA_OWNER_TYPES, description: "Entity type to retrieve" })
  entity: MediaOwnerType;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for resource to retrieve" })
  uuid: string;

  @ApiProperty({ description: "Media collection to retrieve" })
  collection: string;
}
