import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Application } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { EmbeddedSubmissionDto } from "../../entities/dto/submission.dto";

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
  fundingProgrammeName: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeUuid: string | null;
}
