import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";

@JsonApiDto({ type: "disturbances" })
export class DisturbanceDto extends AssociationDto {
  constructor(disturbance: Disturbance, additional: AssociationDtoAdditionalProps) {
    super();
    populateDto<DisturbanceDto, Disturbance>(this, disturbance, additional);
  }

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  intensity: string | null;

  @ApiProperty({ nullable: true, type: String })
  extent: string | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;
}
