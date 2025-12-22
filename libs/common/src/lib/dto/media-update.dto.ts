import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "../util/json-api-update-dto";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class MediaUpdateAttributes {
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The name of the media",
    required: false
  })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The title of the media",
    required: false
  })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The description of the media",
    required: false
  })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The photographer of the media",
    required: false
  })
  photographer?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: "The public status of the media",
    required: false
  })
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: "The cover of the project",
    required: false
  })
  isCover?: boolean;
}

export class MediaUpdateBody extends JsonApiBodyDto(
  class MediaData extends JsonApiDataDto({ type: "media" }, MediaUpdateAttributes) {}
) {}
