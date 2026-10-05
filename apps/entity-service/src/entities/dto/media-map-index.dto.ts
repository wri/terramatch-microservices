import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Media } from "@terramatch-microservices/database/entities";

export class MediaMapEntryDto {
  constructor(media: Media, additional: AdditionalProps<MediaMapEntryDto, Media>) {
    populateDto<MediaMapEntryDto, Media>(this, media, additional);
  }

  @ApiProperty({ description: "UUID of the media." })
  uuid: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: "Latitude of the photo. Always present: only geotagged media are indexed." })
  lat: number;

  @ApiProperty({ description: "Longitude of the photo. Always present: only geotagged media are indexed." })
  lng: number;

  @ApiProperty({ nullable: true, type: String, description: "Null if the thumbnail conversion was not generated." })
  thumbUrl: string | null;

  @ApiProperty()
  isCover: boolean;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;
}

@JsonApiDto({ type: "mediaMapIndexes" })
export class MediaMapIndexDto {
  constructor(media: MediaMapEntryDto[]) {
    this.media = media;
    this.total = media.length;
  }

  @ApiProperty({
    type: () => MediaMapEntryDto,
    isArray: true,
    description: "Every geotagged media in scope for the requested entity."
  })
  media: MediaMapEntryDto[];

  @ApiProperty({ description: "Number of media in the media array." })
  total: number;
}
