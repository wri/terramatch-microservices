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
import { MediaDto } from "./media.dto";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";

@JsonApiDto({ type: "nurseries" })
export class DisturbanceLightDto extends EntityDto {
  constructor(nursery?: Disturbance, props?: AdditionalNurseryLightProps) {
    super();
    if (nursery != null) {
      this.populate(DisturbanceLightDto, {
        ...pickApiProperties(nursery, DisturbanceLightDto),
        lightResource: true,
        ...props,
        // these two are untyped and marked optional in the base model.
        createdAt: nursery.createdAt as Date,
        updatedAt: nursery.updatedAt as Date
      });
    }
  }

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true, description: "Framework key for this nursery" })
  frameworkKey: string | null;

  @ApiProperty({
    nullable: true,
    description: "Entity status for this nursery",
    enum: ENTITY_STATUSES
  })
  status: EntityStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this nursery",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project organisation name"
  })
  organisationName: string | null;

  @ApiProperty({ nullable: true })
  startDate: Date | null;

  @ApiProperty({ nullable: true })
  endDate: Date | null;

  @ApiProperty({ nullable: true })
  seedlingsGrownCount: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalNurseryLightProps = Pick<DisturbanceLightDto, "seedlingsGrownCount">;
export type AdditionalNurseryFullProps = AdditionalNurseryLightProps &
  AdditionalProps<DisturbanceFullDto, DisturbanceLightDto & Omit<Nursery, "project">>;
export type NurseryMedia = Pick<DisturbanceFullDto, keyof typeof Nursery.MEDIA>;

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
  feedback: string | null;

  @ApiProperty({ nullable: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true })
  type: string | null;

  @ApiProperty({ nullable: true })
  seedlingGrown: number | null;

  @ApiProperty({ nullable: true })
  plantingContribution: string | null;

  @ApiProperty({ nullable: true })
  oldModel: string | null;

  @ApiProperty({ nullable: true })
  nurseryReportsTotal: number | null;

  @ApiProperty({ nullable: true })
  overdueNurseryReportsTotal: number | null;

  @ApiProperty({ nullable: true })
  organisationName: string | null;

  @ApiProperty({ nullable: true })
  projectName: string | null;

  @ApiProperty({ nullable: true })
  projectUuid: string | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  file: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  otherAdditionalDocuments: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  photos: MediaDto[];
}
