import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsNumber } from "class-validator";

export class ExtraMediaRequest {
  @IsBoolean()
  @ApiProperty({ description: "Whether the media is public" })
  isPublic: boolean;

  @IsNumber()
  @ApiProperty({ description: "The latitude of the media" })
  lat: number;

  @IsNumber()
  @ApiProperty({ description: "The longitude of the media" })
  lng: number;
}
