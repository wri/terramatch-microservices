import { ApiProperty } from "@nestjs/swagger";
import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Media } from "@terramatch-microservices/database/entities";

export class MediaDto extends JsonApiAttributes<MediaDto> {
  constructor(media: Media, url: string, thumbUrl: string) {
    super({
      ...pickApiProperties(media, MediaDto),
      url,
      thumbUrl,
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
}
