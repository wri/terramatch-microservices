import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import {
  ABOUT_SECTION_TYPES,
  AboutSection,
  AboutSectionType
} from "@terramatch-microservices/database/entities/about-section.entity";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";

@JsonApiConstants
export class AboutSectionConstants {
  @ApiProperty({ example: ABOUT_SECTION_TYPES })
  TYPES: string[];
}

export class LinkDto {
  @ApiProperty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  title: string;

  @IsUrl()
  @IsNotEmpty()
  @ApiProperty()
  url: string;
}

type AboutSectionWithoutExtras = Pick<AboutSection, "type" | "frameworks">;

@JsonApiDto({ type: "aboutSections" })
export class AboutSectionDto {
  constructor(
    aboutSection: AboutSectionWithoutExtras,
    additional: AdditionalProps<AboutSectionDto, AboutSectionWithoutExtras>
  ) {
    populateDto<AboutSectionDto, AboutSectionWithoutExtras>(this, aboutSection, additional);
  }

  @ApiProperty()
  id: string;

  @IsIn(ABOUT_SECTION_TYPES)
  @ApiProperty({ enum: ABOUT_SECTION_TYPES })
  type: AboutSectionType;

  @IsOptional()
  @IsIn(FRAMEWORK_KEYS, { each: true })
  @IsArray()
  @ApiProperty({ enum: FRAMEWORK_KEYS, required: false, nullable: true, isArray: true })
  frameworks?: FrameworkKey[] | null;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  header: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  title?: string | null;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description:
      "The content of the about section in semantic HTML to be parsed into design system components on the client."
  })
  description: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  contactSupportMessage: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  contactSupportSubject: string;

  @ApiProperty({ isArray: true, type: LinkDto })
  links: LinkDto[];
}

export class StoreLinkAttributes extends OmitType(LinkDto, ["id"]) {
  // optional on request, but not in response
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  id?: string;
}

export class StoreAboutSectionAttributes extends OmitType(AboutSectionDto, ["id", "links"]) {
  // optional on request, but not in response
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  id?: string;

  @ValidateNested()
  @Type(() => StoreLinkAttributes)
  @ApiProperty({ type: () => StoreLinkAttributes, isArray: true })
  links: StoreLinkAttributes[];
}

export class CreateAboutSectionBody extends JsonApiBodyDto(
  class CreateAboutSectionData extends CreateDataDto("aboutSections", StoreAboutSectionAttributes) {}
) {}

export class UpdateAboutSectionBody extends JsonApiBodyDto(
  class UpdateAboutSectionData extends JsonApiDataDto({ type: "aboutSections" }, StoreAboutSectionAttributes) {}
) {}
