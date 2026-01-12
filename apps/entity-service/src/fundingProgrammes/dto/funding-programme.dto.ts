import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
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
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsDate, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

type FundingProgrammeExtras = "name" | "description" | "location" | "stages";
type FundingProgrammeWithoutExtras = Omit<FundingProgramme, FundingProgrammeExtras>;

export class StageDto {
  @ApiProperty()
  uuid: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true, type: String })
  name?: string | null;

  @ApiProperty({ nullable: true, type: Date })
  deadlineAt: Date | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true, type: String })
  formUuid?: string | null;
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

  @IsOptional()
  @IsEnum(FRAMEWORK_KEYS)
  @ApiProperty({ required: false, nullable: true, enum: FRAMEWORK_KEYS })
  frameworkKey?: FrameworkKey | null;

  @IsString()
  @ApiProperty()
  name: string;

  @IsString()
  @ApiProperty()
  description: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true, type: String })
  location?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true, type: String })
  readMoreUrl?: string | null;

  @IsEnum(FUNDING_PROGRAMME_STATUSES)
  @ApiProperty({ enum: FUNDING_PROGRAMME_STATUSES })
  status: FundingProgrammeStatus;

  @IsOptional()
  @IsEnum(ORGANISATION_TYPES, { each: true })
  @ApiProperty({ required: false, isArray: true, enum: ORGANISATION_TYPES })
  organisationTypes?: OrganisationType[] | null;

  @ApiProperty({ nullable: true, type: EmbeddedMediaDto })
  cover: EmbeddedMediaDto | null;

  @ApiProperty({ nullable: true, type: StageDto, isArray: true })
  stages: StageDto[] | null;
}

export class StoreStageAttributes extends PickType(StageDto, ["name", "formUuid"]) {
  // optional on request, but not in response
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  uuid?: string;

  // This can't be marked nullable in the request, or the class transformer chokes on converting to a Date instance.
  @IsOptional()
  @IsDate()
  @ApiProperty({ required: false, type: Date })
  deadlineAt?: Date;
}

export class StoreFundingProgrammeAttributes extends PickType(FundingProgrammeDto, [
  "name",
  "description",
  "location",
  "readMoreUrl",
  "status",
  "frameworkKey",
  "organisationTypes"
]) {
  @ValidateNested()
  @Type(() => StoreStageAttributes)
  @ApiProperty({ required: false, isArray: true, type: () => StoreStageAttributes })
  stages?: StoreStageAttributes[];
}

export class CreateFundingProgrammeBody extends JsonApiBodyDto(
  class CreateFundingProgrammeData extends CreateDataDto("fundingProgrammes", StoreFundingProgrammeAttributes) {}
) {}

export class UpdateFundingProgrammeBody extends JsonApiBodyDto(
  class UpdateFundingProgrammeData extends JsonApiDataDto(
    { type: "fundingProgrammes" },
    StoreFundingProgrammeAttributes
  ) {}
) {}
