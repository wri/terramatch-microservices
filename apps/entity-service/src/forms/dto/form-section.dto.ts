import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { StormFormQuestionAttributes, FormQuestionDto } from "./form-question.dto";
import { FormSection } from "@terramatch-microservices/database/entities";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

type StepDefinitionExtras = "title" | "description" | "id";
type FormSectionWithoutExtras = Omit<FormSection, StepDefinitionExtras>;

@JsonApiDto({ type: "formSections" })
export class FormSectionDto {
  constructor(section: FormSectionWithoutExtras, props: AdditionalProps<FormSectionDto, FormSectionWithoutExtras>) {
    populateDto<FormSectionDto, FormSectionWithoutExtras>(this, section, props);
  }

  @ApiProperty()
  id: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: String, description: "Translated section title" })
  title: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true, required: false, type: String, description: "Translated section description" })
  description: string | null;

  @ApiProperty({ type: () => FormQuestionDto, isArray: true })
  questions: FormQuestionDto[];
}

export class StoreFormSectionAttributes extends PickType(FormSectionDto, ["title", "description"]) {
  @ValidateNested()
  @Type(() => StormFormQuestionAttributes)
  @ApiProperty({ required: false, type: () => StormFormQuestionAttributes, isArray: true })
  questions?: StormFormQuestionAttributes[];
}
