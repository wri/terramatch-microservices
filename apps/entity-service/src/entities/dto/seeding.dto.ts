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

  @ApiProperty({ required: false })
  name: string | null;

  @ApiProperty({ required: false })
  amount: number | null;

  @ApiProperty({ required: false })
  taxonId: string | null;

  @ApiProperty({ required: false })
  weightOfSample: number | null;

  @ApiProperty({ required: false })
  seedsInSample: number | null;
}
