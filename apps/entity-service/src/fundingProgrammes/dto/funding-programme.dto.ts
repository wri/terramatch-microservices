import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import {
  FRAMEWORK_KEYS,
  FrameworkKey,
  ORGANISATION_TYPES,
  OrganisationType
} from "@terramatch-microservices/database/constants";
import {
  FUNDING_PROGRAMME_STATUSES,
  FundingProgrammeStatus
} from "@terramatch-microservices/database/constants/status";
import { EmbeddedMediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { FundingProgramme } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

type FundingProgrammeExtras = "name" | "description" | "location";
type FundingProgrammeWithoutExtras = Omit<FundingProgramme, FundingProgrammeExtras>;

export class StageDto {
  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: Date })
  deadlineAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  formUuid: string | null;
}

@JsonApiDto({ type: "fundingProgrammes" })
export class FundingProgrammeDto {
  constructor(
    fundingProgramme?: FundingProgramme,
    additional?: AdditionalProps<FundingProgrammeDto, FundingProgrammeWithoutExtras>
  ) {
    if (fundingProgramme != null && additional != null) {
      populateDto<FundingProgrammeDto, FundingProgrammeWithoutExtras>(this, fundingProgramme, additional);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, enum: FRAMEWORK_KEYS })
  framework: FrameworkKey | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true, type: String })
  location: string | null;

  @ApiProperty({ nullable: true, type: String })
  readMoreUrl: string | null;

  @ApiProperty({ enum: FUNDING_PROGRAMME_STATUSES })
  status: FundingProgrammeStatus;

  @ApiProperty({ isArray: true, enum: ORGANISATION_TYPES })
  organisationTypes: OrganisationType[] | null;

  @ApiProperty({ nullable: true, type: EmbeddedMediaDto })
  cover: EmbeddedMediaDto | null;

  @ApiProperty({ nullable: true, type: StageDto, isArray: true })
  stages: StageDto[] | null;
}
