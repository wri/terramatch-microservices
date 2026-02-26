import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export const AGGREGATE_REPORTS_ENTITY_TYPES = ["projects", "sites"] as const;
export type AggregateReportsEntityType = (typeof AGGREGATE_REPORTS_ENTITY_TYPES)[number];

export class AggregateReportsParamsDto extends SingleResourceDto {
  @IsIn(AGGREGATE_REPORTS_ENTITY_TYPES)
  @ApiProperty({
    enum: AGGREGATE_REPORTS_ENTITY_TYPES,
    description: "Entity type (project or site) for aggregate reports."
  })
  entity: AggregateReportsEntityType;
}
