import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { Invasive } from "@terramatch-microservices/database/entities/invasive.entity";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";

@JsonApiDto({ type: "invasives" })
export class InvasiveDto extends AssociationDto<InvasiveDto> {
  constructor(invasive: Invasive, additional: AssociationDtoAdditionalProps) {
    super({
      ...pickApiProperties(invasive, InvasiveDto),
      ...additional
    });
  }

  @ApiProperty({ nullable: true })
  type: string | null;

  @ApiProperty({ nullable: true })
  name: string | null;
}
