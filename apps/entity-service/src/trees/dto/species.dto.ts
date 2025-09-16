import { ApiProperty } from "@nestjs/swagger";

export class SpeciesDto {
  @ApiProperty({ description: "The scientific name for this tree species" })
  name: string;

  @ApiProperty({ nullable: true, type: String, description: "Taxonomic ID for this tree species row" })
  taxonId?: string | null;
}
