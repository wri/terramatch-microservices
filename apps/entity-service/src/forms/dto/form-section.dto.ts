import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { FormQuestionDto } from "./form-question.dto";
import { FormSection } from "@terramatch-microservices/database/entities";

type StepDefinitionExtras = "title" | "description" | "id";
type FormSectionWithoutExtras = Omit<FormSection, StepDefinitionExtras>;

@JsonApiDto({ type: "formSections" })
export class FormSectionDto {
  constructor(section: FormSectionWithoutExtras, props: AdditionalProps<FormSectionDto, FormSectionWithoutExtras>) {
    populateDto<FormSectionDto, FormSectionWithoutExtras>(this, section, props);
  }

  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: String, description: "Translated section title" })
  title: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated section description" })
  description: string | null;

  @ApiProperty({ type: () => FormQuestionDto, isArray: true })
  questions: FormQuestionDto[];
}
