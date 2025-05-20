import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { Invasive } from "@terramatch-microservices/database/entities/invasive.entity";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";

@JsonApiDto({ type: "invasives" })
export class InvasiveDto extends AssociationDto {
  constructor(invasive: Invasive, additional: AssociationDtoAdditionalProps) {
    super();
    populateDto<InvasiveDto, Invasive>(this, invasive, additional);
  }

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;
}
