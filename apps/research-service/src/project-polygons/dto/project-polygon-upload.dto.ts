import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ProjectPolygonUploadAttributesDto {
  @ApiProperty({ description: "UUID of the project pitch to create the polygon for" })
  @IsString()
  @IsNotEmpty()
  projectPitchUuid: string;
}

export class ProjectPolygonUploadRequestDto extends JsonApiBodyDto(
  class ProjectPolygonUploadData extends CreateDataDto("projectPolygons", ProjectPolygonUploadAttributesDto) {}
) {}
