import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Application } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { EmbeddedSubmissionDto } from "../../entities/dto/submission.dto";
import { AUDIT_STATUS_TYPES, AuditStatusType } from "@terramatch-microservices/database/constants";
import { FORM_SUBMISSION_STATUSES, FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";

@JsonApiDto({ type: "applications" })
export class ApplicationDto {
  constructor(application?: Application, additional?: AdditionalProps<ApplicationDto, Application>) {
    if (application != null && additional != null) {
      populateDto<ApplicationDto, Application>(this, application, additional);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({
    isArray: true,
    type: EmbeddedSubmissionDto,
    description: "List of submissions for this application. The last is the current submission."
  })
  submissions: EmbeddedSubmissionDto[];

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeName: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeUuid: string | null;
}

export class ApplicationHistoryEntryDto {
  @ApiProperty({ nullable: true, enum: AUDIT_STATUS_TYPES })
  eventType: AuditStatusType | null;

  @ApiProperty({ nullable: true, enum: FORM_SUBMISSION_STATUSES })
  status: FormSubmissionStatus | null;

  @ApiProperty()
  date: Date;

  @ApiProperty({ nullable: true, type: String })
  stageName: string | null;

  @ApiProperty({ nullable: true, type: String })
  comment: string | null;
}

@JsonApiDto({ type: "applicationHistories" })
export class ApplicationHistoryDto {
  @ApiProperty()
  applicationUuid: string;

  @ApiProperty({
    isArray: true,
    type: ApplicationHistoryEntryDto,
    description:
      "List of application history entries sorted in reverse chronological order. The first entry is the most recent."
  })
  entries: ApplicationHistoryEntryDto[];
}
