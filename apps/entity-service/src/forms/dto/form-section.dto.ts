import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "formSections" })
export class FormSectionDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty({ description: "Form id" })
  formId: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ nullable: true, type: String, description: "Translated section title" })
  title: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated section subtitle" })
  subtitle: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated section description" })
  description: string | null;
}
