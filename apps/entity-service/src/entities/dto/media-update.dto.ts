import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class MediaUpdateAttributes {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: "The name of the media" })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "The title of the media" })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "The photographer of the media" })
  photographer?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "The public status of the media" })
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "The cover of the project" })
  isCover?: boolean;
}

export class MediaUpdateBody extends JsonApiBodyDto(
  class MediaData extends CreateDataDto("medias", MediaUpdateAttributes) {}
) {}
