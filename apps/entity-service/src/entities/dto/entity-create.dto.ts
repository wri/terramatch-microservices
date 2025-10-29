import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { CreateDataDto, JsonApiMultiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class EntityCreateAttributes {
  @IsUUID()
  @ApiProperty({ description: "UUID of the entity related to the report", required: true })
  parentUuid: string;
}

// Create data DTOs - Only for supported entity types
export class DisturbanceReportCreateData extends CreateDataDto("disturbanceReports", EntityCreateAttributes) {}

// Union type for all create data
export type EntityCreateData = EntityCreateAttributes;

// Multi-body DTO for handling different entity types
export class EntityCreateBody extends JsonApiMultiBodyDto([DisturbanceReportCreateData] as const) {}
