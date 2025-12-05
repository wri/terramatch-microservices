import { JsonApiDto } from "../decorators";
import { populateDto } from "./json-api-attributes";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { Invasive } from "@terramatch-microservices/database/entities/invasive.entity";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";

@JsonApiDto({ type: "invasives" })
export class InvasiveDto extends AssociationDto {
  constructor(invasive?: Invasive, additional?: AssociationDtoAdditionalProps) {
    super();
    if (invasive != null && additional != null) populateDto<InvasiveDto, Invasive>(this, invasive, additional);
  }

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;
}

export class EmbeddedInvasiveDto extends PickType(InvasiveDto, ["type", "name"]) {
  constructor(invasive: Invasive) {
    super();
    populateDto<EmbeddedInvasiveDto>(this, invasive);
  }

  @ApiProperty()
  uuid: string;
}
