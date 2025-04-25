import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, EntityDto } from "./entity.dto";
import { Nursery } from "@terramatch-microservices/database/entities";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";
import { AllowNull, Column } from "sequelize-typescript";
import { STRING, TEXT } from "sequelize";

@JsonApiDto({ type: "disturbances" })
export class DisturbanceLightDto extends EntityDto {
  constructor(disturbance?: Disturbance, props?: AdditionalNurseryLightProps) {
    super();
    if (disturbance != null) {
      this.populate(DisturbanceLightDto, {
        ...pickApiProperties(disturbance, DisturbanceLightDto),
        lightResource: true,
        ...props,
        // these two are untyped and marked optional in the base model.
        createdAt: disturbance.createdAt as Date,
        updatedAt: disturbance.updatedAt as Date
      });
    }
  }

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalNurseryLightProps = DisturbanceLightDto;
export type AdditionalNurseryFullProps = AdditionalNurseryLightProps &
  AdditionalProps<DisturbanceFullDto, DisturbanceLightDto & Omit<Nursery, "project">>;

export class DisturbanceFullDto extends DisturbanceLightDto {
  constructor(nursery: Disturbance, props: AdditionalNurseryFullProps) {
    super();
    this.populate(DisturbanceFullDto, {
      ...pickApiProperties(nursery, DisturbanceFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: nursery.createdAt as Date,
      updatedAt: nursery.updatedAt as Date,
      ...props
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
}
