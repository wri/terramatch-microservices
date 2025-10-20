import { FORM_MODEL_TYPES, FormModelType } from "@terramatch-microservices/common/linkedFields";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";

export class LinkedFieldQueryDto {
  @ApiProperty({ enum: FORM_MODEL_TYPES, isArray: true, required: false, name: "formTypes" })
  @IsOptional()
  @IsArray()
  @IsIn(FORM_MODEL_TYPES, { each: true })
  formModelTypes?: FormModelType[];
}
