import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Application, FormSubmission } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

export class SubmissionReferenceDto {
  constructor(submission?: FormSubmission) {
    if (submission != null) populateDto<SubmissionReferenceDto>(this, submission);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  status: string | null;

  @ApiProperty({ nullable: true, type: String })
  stageName: string | null;
}

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
    type: SubmissionReferenceDto,
    description: "List of submissions for this application. The last is the current submission."
  })
  submissions: SubmissionReferenceDto[];

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeName: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeUuid: string | null;
}
