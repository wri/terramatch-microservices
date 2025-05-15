import { ApiProperty } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Media } from "@terramatch-microservices/database/entities";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "media" })
export class MediaDto extends AssociationDto {
  constructor(media: Media, additional: AdditionalProps<MediaDto, Media>) {
    super();
    populateDto<MediaDto, Media>(this, media, additional);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  collectionName: string;

  @ApiProperty({ nullable: true })
  url: string | null;

  @ApiProperty({ nullable: true })
  thumbUrl: string | null;

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
  createdByUserName: string | null;
}
