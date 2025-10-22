import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { INPUT_TYPES, InputType } from "@terramatch-microservices/database/constants/linked-fields";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { FormQuestion } from "@terramatch-microservices/database/entities";
import { OptionLabelDto } from "./option-label.dto";
import { FORM_MODEL_TYPES, FormModelType } from "@terramatch-microservices/common/linkedFields";
import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class FormQuestionOptionDto extends OptionLabelDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: String })
  thumbUrl: string | null;
}

type FieldDefinitionExtras = "label" | "description" | "placeholder" | "collection" | "name";
type FormQuestionWithoutExtras = Omit<FormQuestion, FieldDefinitionExtras>;

@JsonApiDto({ type: "formQuestions" })
export class FormQuestionDto {
  constructor(question: FormQuestionWithoutExtras, props: AdditionalProps<FormQuestionDto, FormQuestionWithoutExtras>) {
    populateDto<FormQuestionDto, FormQuestionWithoutExtras>(this, question, props);
  }

  @IsString()
  @ApiProperty()
  name: string;

  @IsIn(INPUT_TYPES)
  @ApiProperty({ enum: INPUT_TYPES })
  inputType: InputType;

  @IsString()
  @ApiProperty()
  label: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: String })
  placeholder?: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: String })
  description?: string | null;

  @IsObject()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Object })
  validation?: object | null;

  @ApiProperty()
  multiChoice: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  collection?: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: String })
  optionsList?: string | null;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Boolean })
  optionsOther?: boolean | null;

  @ApiProperty({ nullable: true, type: FormQuestionOptionDto, isArray: true })
  options: FormQuestionOptionDto[] | null;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Boolean })
  showOnParentCondition?: boolean | null;

  @ApiProperty({ nullable: true, enum: FORM_MODEL_TYPES })
  model: FormModelType | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  linkedFieldKey?: string | null;

  @ApiProperty()
  isParentConditionalDefault: boolean;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Number })
  minCharacterLimit?: number | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Number })
  maxCharacterLimit?: number | null;

  @IsNumber({ maxDecimalPlaces: 0 }, { each: true })
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Number, isArray: true })
  years?: number[] | null;

  @IsString({ each: true })
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: String, isArray: true })
  tableHeaders?: string[] | null;

  @IsObject()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: Object })
  additionalProps?: object | null;

  @ApiProperty({ nullable: true, type: () => FormQuestionDto, isArray: true })
  children: FormQuestionDto[] | null;
}

export class StoreFormQuestionOptionAttributes extends PickType(FormQuestionOptionDto, ["slug", "label", "imageUrl"]) {}

export class StormFormQuestionAttributes extends PickType(FormQuestionDto, [
  "linkedFieldKey",
  "collection",
  "label",
  "inputType",
  "name",
  "placeholder",
  "description",
  "validation",
  "additionalProps",
  "optionsList",
  "optionsOther",
  "years",
  "tableHeaders",
  "showOnParentCondition",
  "minCharacterLimit",
  "maxCharacterLimit"
]) {
  // optional on request, but not in response
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  multiChoice?: boolean;

  @ValidateNested()
  @Type(() => StormFormQuestionAttributes)
  @ApiProperty({ required: false, type: () => StormFormQuestionAttributes, isArray: true })
  children?: StormFormQuestionAttributes[];

  @ValidateNested()
  @Type(() => StoreFormQuestionOptionAttributes)
  @ApiProperty({ required: false, type: () => StoreFormQuestionOptionAttributes, isArray: true })
  options?: StoreFormQuestionOptionAttributes[];
}
