import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { FORM_SUBMISSION_STATUSES, FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { Dictionary } from "lodash";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";

@JsonApiDto({ type: "submissions" })
export class SubmissionDto {
  constructor(
    submission?: FormSubmission,
    additional?: AdditionalProps<SubmissionDto, Omit<FormSubmission, "answers">>
  ) {
    if (submission != null && additional != null) {
      populateDto<SubmissionDto, FormSubmission>(this, submission, additional);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: String })
  updatedByName: string | null;

  @ApiProperty({ nullable: true, type: String })
  applicationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectPitchUuid: string | null;

  @ApiProperty({ nullable: true, type: String, enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey | null;

  @ApiProperty()
  @IsString()
  formUuid: string;

  @ApiProperty({ required: false, nullable: true, enum: FORM_SUBMISSION_STATUSES })
  @IsOptional()
  @IsEnum(FORM_SUBMISSION_STATUSES)
  status?: FormSubmissionStatus;

  @ApiProperty()
  answers: Dictionary<unknown>;

  @ApiProperty({ nullable: true, type: String })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  feedback?: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  translatedFeedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  stageName: string | null;

  @ApiProperty({ nullable: true, type: String })
  stageUuid: string | null;
}

export class EmbeddedSubmissionDto extends PickType(SubmissionDto, [
  "uuid",
  "createdAt",
  "updatedAt",
  "updatedByName",
  "status",
  "stageName"
]) {
  constructor(submission?: FormSubmission) {
    super();
    if (submission != null)
      populateDto<EmbeddedSubmissionDto, FormSubmission>(this, submission, {
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt
      });
  }
}

export class CreateSubmissionAttributes {
  @ApiProperty()
  @IsString()
  fundingProgrammeUuid: string;

  @ApiProperty({
    required: false,
    type: String,
    description: "If supplied, a submission will be created for the stage following this one."
  })
  @IsOptional()
  @IsString()
  nextStageFromSubmissionUuid?: string;
}
export class CreateSubmissionBody extends JsonApiBodyDto(
  class CreateSubmissionData extends CreateDataDto("submissions", CreateSubmissionAttributes) {}
) {}

export class UpdateSubmissionAttributes extends PickType(SubmissionDto, ["status", "feedback"]) {
  // Optional in update if this is a status update.
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  answers?: Dictionary<unknown>;

  @ApiProperty({ required: false, type: String, isArray: true })
  @IsOptional()
  @IsString({ each: true })
  feedbackFields?: string[] | null;
}
export class UpdateSubmissionBody extends JsonApiBodyDto(
  class UpdateSubmissionData extends JsonApiDataDto({ type: "submissions" }, UpdateSubmissionAttributes) {}
) {}
