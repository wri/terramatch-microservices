import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";

@JsonApiDto({ type: "disturbances" })
export class DisturbanceDto extends AssociationDto<DisturbanceDto> {
  constructor(disturbance: Disturbance, additional: AssociationDtoAdditionalProps) {
    super({
      ...pickApiProperties(disturbance, DisturbanceDto),
      ...additional
    });
  }

  @ApiProperty({ nullable: true })
  collection: string | null;

  @ApiProperty({ nullable: true })
  type: string | null;

  @ApiProperty({ nullable: true })
  intensity: string | null;

  @ApiProperty({ nullable: true })
  extent: string | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  oldId: number;

  @ApiProperty({ nullable: true })
  oldModel: string | null;

  @ApiProperty({ nullable: true })
  hidden: number | null;
}
