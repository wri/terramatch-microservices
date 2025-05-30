import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "treeRestorationGoals" })
export class TreeRestorationGoalDto {
  constructor(data: TreeRestorationGoalDto) {
    populateDto<TreeRestorationGoalDto>(this, data);
  }

  @ApiProperty({
    description: "Total number of trees grown goal for for-profit organizations",
    type: Number
  })
  forProfitTreeCount: number;

  @ApiProperty({
    description: "Total number of trees grown goal for non-profit organizations",
    type: Number
  })
  nonProfitTreeCount: number;

  @ApiProperty({
    description: "Total trees grown goal across all organizations",
    type: Number
  })
  totalTreesGrownGoal: number;

  @ApiProperty({
    description: "Total number of trees under restoration across all organizations",
    type: Number
  })
  treesUnderRestorationActualTotal: number;

  @ApiProperty({
    description: "Total number of trees under restoration for for-profit organizations",
    type: Number
  })
  treesUnderRestorationActualForProfit: number;

  @ApiProperty({
    description: "Total number of trees under restoration for non-profit organizations",
    type: Number
  })
  treesUnderRestorationActualNonProfit: number;

  @ApiProperty({ nullable: true, type: String })
  lastUpdatedAt: string | null;
}
