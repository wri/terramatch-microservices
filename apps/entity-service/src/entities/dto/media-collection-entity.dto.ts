import { ApiProperty } from "@nestjs/swagger";
import { MEDIA_OWNER_TYPES, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { IsIn } from "class-validator";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class MediaCollectionEntityDto extends SingleResourceDto {
  @IsIn(MEDIA_OWNER_TYPES)
  @ApiProperty({ enum: MEDIA_OWNER_TYPES, description: "Entity type to retrieve" })
  entity: MediaOwnerType;

  @ApiProperty({ description: "Media collection to retrieve" })
  collection: string;
}
