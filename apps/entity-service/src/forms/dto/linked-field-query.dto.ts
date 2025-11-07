import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";
import { FORM_MODEL_TYPES, FormModelType } from "@terramatch-microservices/database/constants";

export class LinkedFieldQueryDto {
  @ApiProperty({ enum: FORM_MODEL_TYPES, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(FORM_MODEL_TYPES, { each: true })
  formModelTypes?: FormModelType[];
}
