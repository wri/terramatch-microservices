import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

const MEDIA_MAP_INDEX_ENTITY_TYPES = ["projects", "sites"] as const;
type MediaMapIndexEntityType = (typeof MEDIA_MAP_INDEX_ENTITY_TYPES)[number];

export class MediaMapIndexParamsDto extends SingleResourceDto {
  @IsIn(MEDIA_MAP_INDEX_ENTITY_TYPES)
  @ApiProperty({ enum: MEDIA_MAP_INDEX_ENTITY_TYPES, description: "Entity type whose map photos are requested." })
  entity: MediaMapIndexEntityType;
}
