import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class GeometryUploadAttributesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  siteId: string;
}

export class GeometryUploadRequestDto extends JsonApiBodyDto(
  class GeometryUploadData extends CreateDataDto("sitePolygons", GeometryUploadAttributesDto) {}
) {}
