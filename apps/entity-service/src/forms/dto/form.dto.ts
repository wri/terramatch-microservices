import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { Form } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HybridSupportDto, HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { FORM_TYPES, FormType } from "@terramatch-microservices/database/constants/forms";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { StoreFormSectionAttributes, FormSectionDto } from "./form-section.dto";
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";

type FormExtras = "title" | "subtitle" | "description" | "submissionMessage";
type FormWithoutExtras = Omit<Form, FormExtras>;

@JsonApiConstants
export class Forms {
  @ApiProperty({ example: FORM_TYPES })
  FORM_TYPES: string[];
}

export class FormAttachment {
  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ["fundingProgramme", "framework", "entity"] })
  type: "fundingProgramme" | "framework" | "entity";

  @ApiProperty({ nullable: true, required: false, type: String })
  adminId?: string | null;
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

  @ApiProperty({ nullable: true, type: MediaDto })
  banner: MediaDto | null;

  @ApiProperty({
    nullable: true,
    required: false,
    type: FormAttachment,
    description: "The funding programme, reporting framework or entity that is using this form."
  })
  attachedTo: FormAttachment | null;
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
  documentationLabel?: string | null;

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

export class StoreFormAttributes extends PickType(FormFullDto, [
  "title",
  "subtitle",
  "frameworkKey",
  "type",
  "description",
  "documentation",
  "documentationLabel",
  "submissionMessage",
  "stageId"
]) {
  @ValidateNested()
  @IsOptional()
  @Type(() => StoreFormSectionAttributes)
  @ApiProperty({ required: false, type: () => StoreFormSectionAttributes, isArray: true })
  sections?: StoreFormSectionAttributes[];
}

export class CreateFormBody extends JsonApiBodyDto(
  class CreateFormData extends CreateDataDto("forms", StoreFormAttributes) {}
) {}

export class UpdateFormBody extends JsonApiBodyDto(
  class UpdateFormData extends JsonApiDataDto({ type: "forms" }, StoreFormAttributes) {}
) {}
