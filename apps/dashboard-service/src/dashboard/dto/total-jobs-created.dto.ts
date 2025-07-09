import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "totalJobsCreated" })
export class TotalJobsCreatedDto {
  constructor(data: TotalJobsCreatedDto) {
    populateDto<TotalJobsCreatedDto>(this, data);
  }
  @ApiProperty()
  totalJobsCreated: number;

  @ApiProperty()
  totalFt: number;

  @ApiProperty()
  totalFtMen: number;

  @ApiProperty()
  totalFtNonYouth: number;

  @ApiProperty()
  totalFtWomen: number;

  @ApiProperty()
  totalFtYouth: number;

  @ApiProperty()
  totalMen: number;

  @ApiProperty()
  totalNonYouth: number;

  @ApiProperty()
  totalPt: number;

  @ApiProperty()
  totalPtMen: number;

  @ApiProperty()
  totalPtNonYouth: number;

  @ApiProperty()
  totalPtWomen: number;

  @ApiProperty()
  totalPtYouth: number;

  @ApiProperty()
  totalWomen: number;

  @ApiProperty()
  totalYouth: number;
}
