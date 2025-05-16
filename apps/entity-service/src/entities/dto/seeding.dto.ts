import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Seeding } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "seedings" })
export class SeedingDto extends AssociationDto {
  constructor(seeding: Seeding, additional: AdditionalProps<SeedingDto, Seeding>) {
    super();
    populateDto<SeedingDto, Seeding>(this, seeding, additional);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: Number })
  amount: number | null;

  @ApiProperty({ nullable: true, type: String })
  taxonId: string | null;

  @ApiProperty({ nullable: true, type: Number })
  weightOfSample: number | null;

  @ApiProperty({ nullable: true, type: Number })
  seedsInSample: number | null;
}
