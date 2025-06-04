import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

class TreeRestorationData {
  @ApiProperty({
    description: "Due date for this restoration data",
    type: String,
    example: "2024-01-01T00:00:00.000000Z"
  })
  dueDate: string;

  @ApiProperty({
    description: "Number of tree species for this period",
    type: Number
  })
  treeSpeciesAmount: number;

  @ApiProperty({
    description: "Percentage of tree species for this period",
    type: Number
  })
  treeSpeciesPercentage: number;
}

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
}
