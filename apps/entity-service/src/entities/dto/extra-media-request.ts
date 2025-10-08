import { ApiProperty } from "@nestjs/swagger";
import { FormDataDataDto, ApiFormDataBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsBoolean, IsNumber, IsOptional } from "class-validator";

class ExtraMediaRequest {
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

  @ApiProperty({ description: "The form data of the media" })
  formData: FormData;
}

export class ExtraMediaRequestBody extends ApiFormDataBodyDto(
  class ExtraMediaRequestData extends FormDataDataDto("media", ExtraMediaRequest) {}
) {}
