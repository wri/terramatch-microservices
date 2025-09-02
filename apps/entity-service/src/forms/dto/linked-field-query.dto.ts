import { FORM_TYPES, FormType } from "@terramatch-microservices/common/linkedFields";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";

export class LinkedFieldQueryDto {
  @ApiProperty({ enum: FORM_TYPES, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(FORM_TYPES, { each: true })
  formTypes?: FormType[];
}
