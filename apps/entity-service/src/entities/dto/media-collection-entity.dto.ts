import { ApiProperty } from "@nestjs/swagger";
import { SpecificEntityDto } from "./specific-entity.dto";

export class MediaCollectionEntityDto extends SpecificEntityDto {
  @ApiProperty({ description: "Media collection to retrieve" })
  collection: string;
}
