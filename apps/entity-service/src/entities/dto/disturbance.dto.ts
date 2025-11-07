import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";

@JsonApiDto({ type: "disturbances" })
export class DisturbanceDto extends AssociationDto {
  constructor(disturbance?: Disturbance, additional?: AssociationDtoAdditionalProps) {
    super();
    if (disturbance != null && additional != null)
      populateDto<DisturbanceDto, Disturbance>(this, disturbance, additional);
  }

  @ApiProperty({ nullable: true, type: String })
  disturbanceDate: Date | null;

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  subtype: string | null;

  @ApiProperty({ nullable: true, type: String })
  intensity: string | null;

  @ApiProperty({ nullable: true, type: String })
  extent: string | null;

  @ApiProperty({ nullable: true, type: Number })
  peopleAffected: number | null;

  @ApiProperty({ nullable: true, type: Number })
  monetaryDamage: number | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String })
  actionDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  propertyAffected: string | null;
}

export class EmbeddedDisturbanceDto extends PickType(DisturbanceDto, ["type", "intensity", "extent", "description"]) {
  constructor(disturbance: Disturbance) {
    super();
    populateDto<EmbeddedDisturbanceDto>(this, disturbance);
  }

  @ApiProperty()
  uuid: string;
}
