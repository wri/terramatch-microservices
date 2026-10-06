import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

export class ReportingPeriodDto {
  @ApiProperty({ example: 2025 })
  dueYear: number;

  @ApiProperty({ minimum: 1, maximum: 12, example: 6 })
  dueMonth: number;
}

// This is a virtual resource with a fixed ID of "reportCounts"
@JsonApiDto({ type: "reportCounts", id: "string" })
export class ReportCountsDto {
  constructor(data: ReportCountsDto) {
    populateDto<ReportCountsDto>(this, data);
  }

  @ApiProperty({ description: "The total number of reports matching the requested filters" })
  totalReports: number;

  @ApiProperty({
    type: [ReportingPeriodDto],
    description:
      "The distinct due month / year of reports matching the requested filters, newest first. The due date " +
      "filters (dueDateFrom, dueDateTo, dueMonth, dueYear) are not applied to this list."
  })
  reportingPeriods: ReportingPeriodDto[];
}
