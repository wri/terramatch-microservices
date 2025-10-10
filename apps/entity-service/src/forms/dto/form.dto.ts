import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { Form } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HybridSupportDto, HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { FORM_TYPES, FormType } from "@terramatch-microservices/database/constants/forms";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { FormSectionDto } from "./form-section.dto";

type FormWithoutTranslations = Omit<Form, "title" | "subtitle" | "description" | "submissionMessage">;

@JsonApiConstants
export class Forms {
  @ApiProperty({ example: FORM_TYPES })
  FORM_TYPES: string[];
}

@JsonApiDto({ type: "forms" })
export class FormLightDto extends HybridSupportDto {
  constructor(form?: FormWithoutTranslations, props?: HybridSupportProps<FormLightDto, FormWithoutTranslations>) {
    super();
    if (form != null && props != null) {
      populateDto<FormLightDto, FormWithoutTranslations>(this, form, { lightResource: true, ...props });
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ description: "Translated form title" })
  title: string;

  @ApiProperty({ nullable: true, enum: FORM_TYPES })
  type: FormType | null;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ nullable: true, type: String })
  bannerUrl: string | null;
}

export class FormFullDto extends FormLightDto {
  constructor(form: FormWithoutTranslations, props: HybridSupportProps<FormFullDto, FormWithoutTranslations>) {
    super();
    populateDto<FormFullDto, FormWithoutTranslations>(this, form, { lightResource: false, ...props });
  }

  @ApiProperty({
    description: "Indicates whether the text fields in this form response have been translated to the user's locale"
  })
  translated: boolean;

  @ApiProperty({ nullable: true, type: String })
  subtitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey;

  @ApiProperty({ nullable: true, type: String })
  documentation: string | null;

  @ApiProperty({ nullable: true, type: String })
  documentationLabel: string | null;

  @ApiProperty({ nullable: true, type: Date })
  deadlineAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  submissionMessage: string | null;

  @ApiProperty({ nullable: true, type: String })
  stageId: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeId: string | null;

  @ApiProperty({ type: () => FormSectionDto, isArray: true })
  sections: FormSectionDto[];
}
