import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { INPUT_TYPES, InputType } from "@terramatch-microservices/database/constants/linked-fields";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { FormQuestion } from "@terramatch-microservices/database/entities";
import { OptionLabelDto } from "./option-label.dto";
import { FORM_MODEL_TYPES, FormModelType } from "@terramatch-microservices/common/linkedFields";

export class FormTableHeaderDto {
  @ApiProperty({ nullable: true, type: String })
  slug: string | null;

  @ApiProperty({ nullable: true, type: String })
  label: string | null;

  @ApiProperty({ nullable: true, type: Number })
  order: number | null;
}

export class FormQuestionOptionDto extends OptionLabelDto {
  @ApiProperty()
  order: number;

  @ApiProperty({ nullable: true, type: String })
  thumbUrl: string | null;
}

type FormQuestionWithoutTranslations = Omit<FormQuestion, "label" | "description" | "placeholder" | "collection">;

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

  @ApiProperty()
  label: string;

  @ApiProperty({ nullable: true, type: String })
  placeholder: string | null;

  @ApiProperty({ nullable: true, type: String })
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

  @ApiProperty({ nullable: true, type: FormQuestionOptionDto, isArray: true })
  options: FormQuestionOptionDto[] | null;

  @ApiProperty({ nullable: true, type: Boolean })
  showOnParentCondition: boolean | null;

  @ApiProperty({ nullable: true, enum: FORM_MODEL_TYPES })
  model: FormModelType | null;

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
