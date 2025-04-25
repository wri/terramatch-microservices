import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, EntityDto } from "./entity.dto";
import { Nursery } from "@terramatch-microservices/database/entities";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { Invasive } from "@terramatch-microservices/database/entities/invasive.entity";

@JsonApiDto({ type: "invasives" })
export class InvasiveLightDto extends EntityDto {
  constructor(invasive?: Invasive, props?: AdditionalInvasiveLightProps) {
    super();
    if (invasive != null) {
      this.populate(InvasiveLightDto, {
        ...pickApiProperties(invasive, InvasiveLightDto),
        lightResource: true,
        ...props,
        // these two are untyped and marked optional in the base model.
        createdAt: invasive.createdAt as Date,
        updatedAt: invasive.updatedAt as Date
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

export type AdditionalInvasiveLightProps = InvasiveLightDto;
export type AdditionalNurseryFullProps = AdditionalInvasiveLightProps &
  AdditionalProps<InvasiveFullDto, InvasiveLightDto & Omit<Nursery, "project">>;

export class InvasiveFullDto extends InvasiveLightDto {
  constructor(invasive: Invasive, props: AdditionalNurseryFullProps) {
    super();
    this.populate(InvasiveFullDto, {
      ...pickApiProperties(invasive, InvasiveFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: invasive.createdAt as Date,
      updatedAt: invasive.updatedAt as Date,
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

  @ApiProperty({ nullable: true })
  oldId: number;

  @ApiProperty({ nullable: true })
  oldModel: string | null;

  @ApiProperty({ nullable: true })
  hidden: number | null;
}
