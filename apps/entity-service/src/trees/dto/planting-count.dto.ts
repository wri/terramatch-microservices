import { ApiProperty } from "@nestjs/swagger";
import { Dictionary } from "lodash";

export type PlantingCountMap = Dictionary<Dictionary<PlantingCountDto>>;

export class PlantingCountDto {
  @ApiProperty({ nullable: true, description: "Taxonomic ID for this tree species row" })
  taxonId?: string;

  @ApiProperty({
    description: "Number of trees of this type that have been planted in all previous reports on this entity."
  })
  amount: number;
}
