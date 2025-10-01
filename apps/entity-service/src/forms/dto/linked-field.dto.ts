import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { INPUT_TYPES, InputType } from "@terramatch-microservices/database/constants/linked-fields";
import { FORM_MODEL_TYPES, FormModelType } from "@terramatch-microservices/common/linkedFields";

@JsonApiDto({ type: "linkedFields", id: "string" })
export class LinkedFieldDto {
  @ApiProperty({ description: "Linked field id" })
  id: string;

  @ApiProperty({ enum: FORM_MODEL_TYPES })
  formModelType: FormModelType;

  @ApiProperty()
  label: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: INPUT_TYPES })
  inputType: InputType;

  @ApiProperty({ nullable: true, type: String })
  optionListKey: string | null;

  @ApiProperty({ nullable: true, type: String })
  multiChoice: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;
}
