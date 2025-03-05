import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, EntityDto } from "./entity.dto";
import { Nursery } from "@terramatch-microservices/database/entities";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import {
  ENTITY_STATUSES,
  EntityStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";

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

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({
    nullable: true,
    description: "Entity status for this nursery",
    enum: ENTITY_STATUSES
  })
  status: EntityStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this project",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

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
