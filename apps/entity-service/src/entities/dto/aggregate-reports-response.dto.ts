import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

export class AggregateReportSeriesItemDto {
  @ApiProperty({
    description: "Reporting task due date (ISO 8601).",
    example: "2024-06-30T23:59:59.000Z"
  })
  dueDate: string;

  @ApiProperty({
    description: "Sum for that reporting period (V2 compatible).",
    example: 1500
  })
  aggregateAmount: number;
}

export interface AggregateReportsAttributes {
  treePlanted?: AggregateReportSeriesItemDto[];
  seedingRecords?: AggregateReportSeriesItemDto[];
  treesRegenerating?: AggregateReportSeriesItemDto[];
}

export type AggregateReportsResponseDto = AggregateReportsAttributes;

@JsonApiDto({ type: "aggregateReports", id: "string" })
export class AggregateReportsDto {
  @ApiProperty({
    type: [AggregateReportSeriesItemDto],
    description: "Trees planted by reporting period (when framework supports it).",
    required: false
  })
  treePlanted?: AggregateReportSeriesItemDto[];

  @ApiProperty({
    type: [AggregateReportSeriesItemDto],
    description: "Seeds planted by reporting period (when framework supports it).",
    required: false
  })
  seedingRecords?: AggregateReportSeriesItemDto[];

  @ApiProperty({
    type: [AggregateReportSeriesItemDto],
    description: "Trees regenerating (ANR) by reporting period (when framework supports it).",
    required: false
  })
  treesRegenerating?: AggregateReportSeriesItemDto[];
}
