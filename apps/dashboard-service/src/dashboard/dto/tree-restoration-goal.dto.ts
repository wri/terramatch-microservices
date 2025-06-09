import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

class TreeRestorationData {
  @ApiProperty({
    description: "Due date for this restoration data"
  })
  dueDate: Date;

  @ApiProperty({
    description: "Number of tree species for this period"
  })
  treeSpeciesAmount: number;

  @ApiProperty({
    description: "Percentage of tree species for this period"
  })
  treeSpeciesPercentage: number;
}

@JsonApiDto({ type: "treeRestorationGoals" })
export class TreeRestorationGoalDto {
  constructor(data: TreeRestorationGoalDto) {
    populateDto<TreeRestorationGoalDto>(this, data);
  }

  @ApiProperty({
    description: "Total number of trees grown goal for for-profit organizations"
  })
  forProfitTreeCount: number;

  @ApiProperty({
    description: "Total number of trees grown goal for non-profit organizations"
  })
  nonProfitTreeCount: number;

  @ApiProperty({
    description: "Total trees grown goal across all organizations"
  })
  totalTreesGrownGoal: number;

  @ApiProperty({
    description: "Trees under restoration data across all organizations by due date",
    type: [TreeRestorationData]
  })
  treesUnderRestorationActualTotal: TreeRestorationData[];

  @ApiProperty({
    description: "Trees under restoration data for for-profit organizations by due date",
    type: [TreeRestorationData]
  })
  treesUnderRestorationActualForProfit: TreeRestorationData[];

  @ApiProperty({
    description: "Trees under restoration data for non-profit organizations by due date",
    type: [TreeRestorationData]
  })
  treesUnderRestorationActualNonProfit: TreeRestorationData[];

  @ApiProperty({
    description: "Timestamp when the data was last updated",
    type: String,
    nullable: true
  })
  lastUpdatedAt: string | null;
}
