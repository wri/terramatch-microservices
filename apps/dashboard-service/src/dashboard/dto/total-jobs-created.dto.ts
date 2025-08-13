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

  @ApiProperty()
  totalNonBinary: number;

  @ApiProperty()
  totalFtNonBinary: number;

  @ApiProperty()
  totalPtNonBinary: number;

  @ApiProperty()
  totalOthersGender: number;

  @ApiProperty()
  totalFtOthersGender: number;

  @ApiProperty()
  totalPtOthersGender: number;

  @ApiProperty()
  totalOthersAge: number;

  @ApiProperty()
  totalPtOthersAge: number;

  @ApiProperty()
  totalFtOthersAge: number;

  @ApiProperty()
  totalVolunteers: number;

  @ApiProperty()
  volunteerMen: number;

  @ApiProperty()
  volunteerWomen: number;

  @ApiProperty()
  volunteerNonBinary: number;

  @ApiProperty()
  volunteerOthers: number;

  @ApiProperty()
  volunteerYouth: number;

  @ApiProperty()
  volunteerNonYouth: number;

  @ApiProperty()
  volunteerAgeOthers: number;
}
