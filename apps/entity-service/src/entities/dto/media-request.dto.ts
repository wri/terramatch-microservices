import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsNumber, IsOptional } from "class-validator";

export class MediaRequestAttributes {
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

export class MediaRequestBody extends JsonApiBodyDto(
  class MediaRequestData extends CreateDataDto("media", MediaRequestAttributes) {}
) {}
