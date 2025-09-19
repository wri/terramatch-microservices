import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { INPUT_TYPES, InputType } from "@terramatch-microservices/database/constants/linked-fields";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { FormQuestion } from "@terramatch-microservices/database/entities";

export class FormTableHeaderDto {
  @ApiProperty({ nullable: true, type: String })
  slug: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated header label" })
  label: string | null;

  @ApiProperty({ nullable: true, type: Number })
  order: number | null;
}

type FormQuestionWithoutTranslations = Omit<FormQuestion, "label" | "description" | "placeholder">;

@JsonApiDto({ type: "formQuestions" })
export class FormQuestionDto {
  constructor(
    question: FormQuestionWithoutTranslations,
    props: AdditionalProps<FormQuestionDto, FormQuestionWithoutTranslations>
  ) {
    populateDto<FormQuestionDto, FormQuestionWithoutTranslations>(this, question, props);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ description: "Form section id" })
  sectionId: string;

  @ApiProperty({ nullable: true, type: String, description: "UUID of the parent question" })
  parentId: string | null;

  @ApiProperty({ enum: INPUT_TYPES })
  inputType: InputType;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ description: "Translated question label" })
  label: string;

  @ApiProperty({ nullable: true, type: String, description: "Translated question placeholder" })
  placeholder: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated question description" })
  description: string | null;

  @ApiProperty({ nullable: true, type: Object })
  validation: object | null;

  @ApiProperty()
  multiChoice: boolean;

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;

  @ApiProperty()
  order: number;

  @ApiProperty({ nullable: true, type: String })
  optionsList: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  optionsOther: boolean | null;

  @ApiProperty({ nullable: true, type: Boolean })
  showOnParentCondition: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  linkedFieldKey: string | null;

  @ApiProperty()
  isParentConditionalDefault: boolean;

  @ApiProperty({ nullable: true, type: Number })
  minCharacterLimit: number | null;

  @ApiProperty({ nullable: true, type: Number })
  maxCharacterLimit: number | null;

  @ApiProperty({ nullable: true, type: Number, isArray: true })
  years: number[] | null;

  @ApiProperty({ nullable: true, type: FormTableHeaderDto, isArray: true })
  tableHeaders: FormTableHeaderDto[] | null;

  @ApiProperty({ nullable: true, type: Object })
  additionalProps: object | null;
}
