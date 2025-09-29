import { IndexQueryDto } from "../../entities/dto/index-query.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { FORM_TYPES, FormType } from "@terramatch-microservices/database/constants/forms";

export class FormQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, enum: FORM_TYPES })
  @IsEnum(FORM_TYPES)
  @IsOptional()
  type?: FormType;
}
