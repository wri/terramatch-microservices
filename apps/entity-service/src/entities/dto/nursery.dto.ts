import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { Nursery } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import {
  ENTITY_STATUSES,
  EntityStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { MediaDto } from "./media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "nurseries" })
export class NurseryLightDto extends EntityDto {
  constructor(nursery?: Nursery, props?: HybridSupportProps<NurseryLightDto, Nursery>) {
    super();
    if (nursery != null && props != null) {
      populateDto<NurseryLightDto, Nursery>(this, nursery, { lightResource: true, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Framework key for this nursery" })
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
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  startDate: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  endDate: Date | null;

  @ApiProperty({ nullable: true, type: Number })
  seedlingsGrownCount: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type NurseryMedia = Pick<NurseryFullDto, keyof typeof Nursery.MEDIA>;

export class NurseryFullDto extends NurseryLightDto {
  constructor(
    nursery: Nursery,
    props: HybridSupportProps<NurseryFullDto, Omit<Nursery, "feedback" | "feedbackFields">>
  ) {
    super();
    populateDto<NurseryFullDto, Nursery>(this, nursery, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: Number })
  seedlingGrown: number | null;

  @ApiProperty({ nullable: true, type: String })
  plantingContribution: string | null;

  @ApiProperty({ nullable: true, type: String })
  oldModel: string | null;

  @ApiProperty({ nullable: true, type: Number })
  nurseryReportsTotal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  overdueNurseryReportsTotal: number | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectUuid: string | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  media: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  file: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  otherAdditionalDocuments: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  photos: MediaDto[];
}
