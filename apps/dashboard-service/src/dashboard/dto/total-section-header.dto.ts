import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "totalSectionHeaders" })
export class TotalSectionHeaderDto {
  constructor(data: TotalSectionHeaderDto) {
    populateDto<TotalSectionHeaderDto>(this, data);
  }
  @ApiProperty()
  totalNonProfitCount: number;

  @ApiProperty()
  totalEnterpriseCount: number;

  @ApiProperty()
  totalEntries: number;

  @ApiProperty()
  totalHectaresRestored: number;

  @ApiProperty()
  totalHectaresRestoredGoal: number;

  @ApiProperty()
  totalTreesRestored: number;

  @ApiProperty()
  totalTreesRestoredGoal: number;

  @ApiProperty({ nullable: true, type: String })
  lastUpdatedAt: string | null;
}
