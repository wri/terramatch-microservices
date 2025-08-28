import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { INPUT_TYPES, InputType } from "@terramatch-microservices/common/linkedFields/types";
import { FORM_TYPES, FormType } from "@terramatch-microservices/common/linkedFields/configuration";

@JsonApiDto({ type: "linkedFields", id: "string" })
export class LinkedFieldDto {
  @ApiProperty({ description: "Linked field id" })
  id: string;

  @ApiProperty({ enum: FORM_TYPES })
  formType: FormType;

  @ApiProperty()
  label: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: INPUT_TYPES })
  inputType: InputType;

  @ApiProperty({ nullable: true })
  optionListKey: string | null;

  @ApiProperty({ nullable: true })
  multiChoice: boolean | null;

  @ApiProperty({ nullable: true })
  collection: string | null;
}
