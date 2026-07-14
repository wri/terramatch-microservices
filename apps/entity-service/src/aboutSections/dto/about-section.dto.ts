import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import {
  ABOUT_SECTION_TYPES,
  AboutSection,
  AboutSectionType
} from "@terramatch-microservices/database/entities/about-section.entity";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

export class LinkDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

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

  @ApiProperty({ enum: ABOUT_SECTION_TYPES })
  type: AboutSectionType;

  @ApiProperty({ enum: FRAMEWORK_KEYS, nullable: true, isArray: true })
  frameworks: FrameworkKey[] | null;

  @ApiProperty()
  header: string;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({
    description:
      "The content of the about section in semantic HTML to be parsed into design system components on the client."
  })
  description: string;

  @ApiProperty()
  contactSupportMessage: string;

  @ApiProperty()
  contactSupportSubject: string;

  @ApiProperty({ isArray: true, type: LinkDto })
  links: LinkDto[];
}
