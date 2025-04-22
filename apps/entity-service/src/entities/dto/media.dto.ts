import { ApiProperty } from "@nestjs/swagger";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Media } from "@terramatch-microservices/database/entities";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { MediaAssociationDtoAdditionalProps } from "./media-association.dto";

@JsonApiDto({ type: "media" })
export class MediaDto extends AssociationDto<MediaDto> {
  constructor(media: Media, additional: MediaAssociationDtoAdditionalProps) {
    super({
      ...pickApiProperties(media, MediaDto),
      ...additional,
      createdAt: media.createdAt
    });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  collectionName: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  thumbUrl: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ nullable: true })
  mimeType: string | null;

  @ApiProperty()
  size: number;

  @ApiProperty({ nullable: true })
  lat: number | null;

  @ApiProperty({ nullable: true })
  lng: number | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  isCover: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  photographer: string | null;

  @ApiProperty({ nullable: true })
  modelType: string | null;

  @ApiProperty({ nullable: true })
  createdBy: number | null;

  @ApiProperty({ nullable: true })
  createdByUserName: string | null;
}
