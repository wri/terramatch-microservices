import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "totalSectionHeaders" })
export class TotalSectionHeaderDto extends JsonApiAttributes<TotalSectionHeaderDto> {
  @ApiProperty()
  totalNonProfitCount: number | null;

  @ApiProperty()
  totalEnterpriseCount: number | null;

  @ApiProperty()
  totalEntries: number | null;

  @ApiProperty()
  totalHectaresRestored: number | null;

  @ApiProperty()
  totalHectaresRestoredGoal: number | null;

  @ApiProperty()
  totalTreesRestored: number | null;

  @ApiProperty()
  totalTreesRestoredGoal: number | null;
}
