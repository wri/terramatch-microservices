import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class GeometryUploadAttributesDto {}

export class GeometryUploadRequestDto extends JsonApiBodyDto(
  class GeometryUploadData extends CreateDataDto("geometryUpload", GeometryUploadAttributesDto) {}
) {}
