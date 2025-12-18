import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { FORM_SUBMISSION_STATUSES, FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { Dictionary } from "lodash";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

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
  formUuid: string;

  @ApiProperty({ nullable: true, enum: FORM_SUBMISSION_STATUSES })
  status: FormSubmissionStatus;

  @ApiProperty()
  answers: Dictionary<unknown>;

  @ApiProperty({ nullable: true, type: String })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

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

export class CreateSubmissionAttributes extends PickType(SubmissionDto, ["formUuid"]) {}
export class CreateSubmissionBody extends JsonApiBodyDto(
  class CreateSubmissionData extends CreateDataDto("submissions", CreateSubmissionAttributes) {}
) {}
