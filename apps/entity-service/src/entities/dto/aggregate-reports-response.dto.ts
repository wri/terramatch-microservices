import { ApiProperty } from "@nestjs/swagger";

export class AggregateReportSeriesItemDto {
  @ApiProperty({
    description: "Reporting task due date (ISO 8601).",
    example: "2024-06-30T23:59:59.000Z"
  })
  dueDate: string;

  @ApiProperty({
    description: "Cumulative count up to that reporting period.",
    example: 1500
  })
  aggregateAmount: number;
}

export class AggregateReportsResponseDto {
  @ApiProperty({
    type: [AggregateReportSeriesItemDto],
    description: "Cumulative trees planted by reporting period (when framework supports it).",
    required: false
  })
  "tree-planted"?: AggregateReportSeriesItemDto[];

  @ApiProperty({
    type: [AggregateReportSeriesItemDto],
    description: "Cumulative seeds planted by reporting period (when framework supports it).",
    required: false
  })
  "seeding-records"?: AggregateReportSeriesItemDto[];

  @ApiProperty({
    type: [AggregateReportSeriesItemDto],
    description: "Cumulative trees regenerating (ANR) by reporting period (when framework supports it).",
    required: false
  })
  "trees-regenerating"?: AggregateReportSeriesItemDto[];
}
