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

export type NurseryMedia = Pick<NurseryFullDto, keyof typeof Nursery.MEDIA>;

export class NurseryFullDto extends NurseryLightDto {
  constructor(nursery: Nursery, props: HybridSupportProps<NurseryFullDto, Nursery>) {
    super();
    populateDto<NurseryFullDto, Nursery>(this, nursery, { lightResource: false, ...props });
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
