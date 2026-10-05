import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

// This is a virtual resource with a fixed ID of "reportCounts"
@JsonApiDto({ type: "reportCounts", id: "string" })
export class ReportCountsDto {
  constructor(totalReports: number) {
    this.totalReports = totalReports;
  }

  @ApiProperty({ description: "The total number of reports matching the requested filters" })
  totalReports: number;
}
