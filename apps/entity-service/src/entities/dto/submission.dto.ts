import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { FORM_SUBMISSION_STATUSES, FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { Dictionary } from "lodash";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

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

  @ApiProperty({ nullable: true, type: String })
  applicationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectPitchUuid: string | null;

  @ApiProperty({ nullable: true, type: String, enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey | null;

  @ApiProperty({ nullable: true, type: String })
  formUuid: string | null;

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
}
