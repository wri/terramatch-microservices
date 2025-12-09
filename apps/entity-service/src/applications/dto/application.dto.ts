import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Application } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "applications" })
export class ApplicationDto {
  constructor(application?: Application, additional?: AdditionalProps<ApplicationDto, Application>) {
    if (application != null && additional != null)
      populateDto<ApplicationDto, Application>(this, application, additional);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  currentSubmissionUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  currentSubmissionStatus: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeName: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeUuid: string | null;
}
