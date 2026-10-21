import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

// Virtual resource, like ReportCountsDto: the id is fixed, so the cached count is tied to the request by the client.
@JsonApiDto({ type: "entityCounts", id: "string" })
export class EntityCountsDto {
  constructor(data: EntityCountsDto) {
    populateDto<EntityCountsDto>(this, data);
  }

  @ApiProperty({ description: "The total number of entities matching the requested filters" })
  total: number;
}

/** Only the filters the sites and nurseries index totals use. */
export class EntityCountsQueryDto {
  @ApiProperty({ required: false, description: "Matches the entity, project or organisation names" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  updateRequestStatus?: string[];

  @ApiProperty({ required: false, description: "Only the project with this uuid" })
  @IsOptional()
  @IsString()
  projectUuid?: string;
}
