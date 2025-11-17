import { ApiProperty } from "@nestjs/swagger";

export class TaxonomicSpeciesDto {
  @ApiProperty({ description: "Taxonomic ID for this tree species" })
  taxonId: string;

  @ApiProperty({ description: "Scientific name for this tree species" })
  scientificName: string;

  @ApiProperty({
    nullable: true,
    type: String,
    isArray: true,
    description: "Array of ISO 3166-1 alpha-3 country codes (GADM level 0) where this species is native",
    example: ["GHA", "KEN"]
  })
  nativeDistribution: string[] | null;

  @ApiProperty({
    nullable: true,
    type: String,
    isArray: true,
    description: "Array of suitability tags (e.g., 'chimpanzee' for research collaborations)",
    example: ["chimpanzee"]
  })
  suitability: string[] | null;
}
