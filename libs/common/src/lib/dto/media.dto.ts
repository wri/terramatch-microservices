import { ApiProperty, OmitType } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "./json-api-attributes";
import { Media } from "@terramatch-microservices/database/entities";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "../decorators";

@JsonApiDto({ type: "media" })
export class MediaDto extends AssociationDto {
  constructor(media?: Media, additional?: AdditionalProps<MediaDto, Media>) {
    super();
    if (media != null && additional != null) populateDto<MediaDto, Media>(this, media, additional);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  collectionName: string;

  @ApiProperty({ nullable: true, type: String })
  url: string | null;

  @ApiProperty({ nullable: true, type: String })
  thumbUrl: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ nullable: true, type: String })
  mimeType: string | null;

  @ApiProperty()
  size: number;

  @ApiProperty({ nullable: true, type: Number })
  lat: number | null;

  @ApiProperty({ nullable: true, type: Number })
  lng: number | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  isCover: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String })
  photographer: string | null;

  @ApiProperty({ nullable: true, type: String })
  createdByUserName: string | null;
}

export class EmbeddedMediaDto extends OmitType(MediaDto, ["entityType", "entityUuid", "createdByUserName"]) {
  constructor(media: Media, additionalProps: AdditionalProps<EmbeddedMediaDto, Media>) {
    super();
    populateDto<EmbeddedMediaDto, Media>(this, media, additionalProps);
  }
}
