import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, EntityDto } from "./entity.dto";
import { Nursery } from "@terramatch-microservices/database/entities";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "nurseries" })
export class NurseryLightDto extends EntityDto {
  constructor(nursery?: Nursery) {
    super();
    if (nursery != null) {
      this.populate(NurseryLightDto, {
        ...pickApiProperties(nursery, NurseryLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: nursery.createdAt as Date,
        updatedAt: nursery.updatedAt as Date
      });
    }
  }

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalNurseryFullProps = AdditionalProps<NurseryFullDto, NurseryLightDto, Nursery>;

export class NurseryFullDto extends NurseryLightDto {
  constructor(nursery: Nursery, props: AdditionalNurseryFullProps) {
    super();
    this.populate(NurseryFullDto, {
      ...pickApiProperties(nursery, NurseryFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: nursery.createdAt as Date,
      updatedAt: nursery.updatedAt as Date,
      ...props
    });
  }
}
