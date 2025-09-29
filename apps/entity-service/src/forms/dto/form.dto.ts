import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { Form } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HybridSupportDto, HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

type FormWithoutTranslations = Omit<Form, "title" | "subtitle" | "description" | "submissionMessage">;

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

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty()
  published: boolean;
}

export class FormDto extends FormLightDto {
  constructor(form: FormWithoutTranslations, props: HybridSupportProps<FormDto, FormWithoutTranslations>) {
    super();
    populateDto<FormDto, FormWithoutTranslations>(this, form, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String, description: "Translated form subtitle" })
  subtitle: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated form description" })
  description: string | null;

  @ApiProperty({ nullable: true, enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey;

  @ApiProperty({ nullable: true, type: String })
  documentation: string | null;

  @ApiProperty({ nullable: true, type: String })
  documentationLabel: string | null;

  @ApiProperty({ nullable: true, type: Date })
  deadlineAt: Date | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated submission message" })
  submissionMessage: string | null;

  @ApiProperty({ nullable: true, type: String })
  stageId: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeId: string | null;
}
