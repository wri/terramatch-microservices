import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl } from "class-validator";

export class MediaRequestBulkAttributes {
  @IsString()
  @IsUrl()
  @ApiProperty({ required: true, description: "The URL of the media" })
  downloadUrl: string;

  @IsBoolean()
  @ApiProperty({ description: "Whether the media is public" })
  isPublic: boolean;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ type: Number, nullable: true, description: "The latitude of the media" })
  lat: number | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ type: Number, nullable: true, description: "The longitude of the media" })
  lng: number | null;
}

export class MediaRequestBulkBody extends JsonApiBulkBodyDto(
  class MediaRequestBulkData extends CreateDataDto("media", MediaRequestBulkAttributes) {},
  {
    minSize: 1,
    minSizeMessage: "At least one media must be provided",
    description: "Array of media to create",
    example: [
      { type: "media", attributes: { isPublic: true, downloadUrl: "https://example.com/image.jpg" } },
      { type: "media", attributes: { isPublic: false, downloadUrl: "https://example.com/image.jpg" } }
    ]
  }
) {}
