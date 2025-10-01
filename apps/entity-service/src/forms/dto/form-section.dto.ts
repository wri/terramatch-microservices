import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

type FormSectionWithoutTranslations = Omit<FormSectionDto, "title" | "description">;

@JsonApiDto({ type: "formSections" })
export class FormSectionDto {
  constructor(
    section: FormSectionWithoutTranslations,
    props: AdditionalProps<FormSectionDto, FormSectionWithoutTranslations>
  ) {
    populateDto<FormSectionDto, FormSectionWithoutTranslations>(this, section, props);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ description: "Form id" })
  formId: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ nullable: true, type: String, description: "Translated section title" })
  title: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated section description" })
  description: string | null;
}
