import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { Form } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HybridSupportDto, HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { FORM_TYPES, FormType } from "@terramatch-microservices/database/constants/forms";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { CreateFormSectionAttributes, FormSectionDto } from "./form-section.dto";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsDate, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

type FormExtras = "title" | "subtitle" | "description" | "submissionMessage";
type FormWithoutExtras = Omit<Form, FormExtras>;

@JsonApiConstants
export class Forms {
  @ApiProperty({ example: FORM_TYPES })
  FORM_TYPES: string[];
}

@JsonApiDto({ type: "forms" })
export class FormLightDto extends HybridSupportDto {
  constructor(form?: FormWithoutExtras, props?: HybridSupportProps<FormLightDto, FormWithoutExtras>) {
    super();
    if (form != null && props != null) {
      populateDto<FormLightDto, FormWithoutExtras>(this, form, { lightResource: true, ...props });
    }
  }

  @ApiProperty()
  uuid: string;

  @IsString()
  @ApiProperty({ description: "Translated form title", type: String })
  title: string;

  @IsOptional()
  @IsIn(FORM_TYPES)
  @ApiProperty({ nullable: true, required: false, enum: FORM_TYPES })
  type?: FormType | null;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ nullable: true, type: String })
  bannerUrl: string | null;
}

export class FormFullDto extends FormLightDto {
  constructor(form: FormWithoutExtras, props: HybridSupportProps<FormFullDto, FormWithoutExtras>) {
    super();
    populateDto<FormFullDto, FormWithoutExtras>(this, form, { lightResource: false, ...props });
  }

  @ApiProperty({
    description: "Indicates whether the text fields in this form response have been translated to the user's locale"
  })
  translated: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  description?: string | null;

  @IsOptional()
  @IsIn(FRAMEWORK_KEYS)
  @ApiProperty({ nullable: true, required: false, enum: FRAMEWORK_KEYS })
  frameworkKey?: FrameworkKey;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  documentation?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  documentationLabel: string | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @ApiProperty({ nullable: true, required: false, type: Date })
  deadlineAt?: Date | null;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  submissionMessage: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ nullable: true, required: false, type: String })
  stageId?: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeId: string | null;

  @ApiProperty({ type: () => FormSectionDto, isArray: true })
  sections: FormSectionDto[];
}

export class CreateFormAttributes extends PickType(FormFullDto, [
  "title",
  "subtitle",
  "frameworkKey",
  "type",
  "description",
  "documentation",
  "documentationLabel",
  "deadlineAt",
  "submissionMessage",
  "stageId"
]) {
  @ValidateNested()
  @IsOptional()
  @Type(() => CreateFormSectionAttributes)
  @ApiProperty({ required: false, type: () => CreateFormSectionAttributes, isArray: true })
  sections?: CreateFormSectionAttributes[];
}

export class FormCreateBody extends JsonApiBodyDto(
  class FormCreateData extends CreateDataDto("forms", CreateFormAttributes) {}
) {}
