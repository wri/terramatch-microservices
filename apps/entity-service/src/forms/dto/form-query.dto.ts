import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { FORM_TYPES, FormType } from "@terramatch-microservices/database/constants/forms";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class FormIndexQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, enum: FORM_TYPES })
  @IsEnum(FORM_TYPES)
  @IsOptional()
  type?: FormType;
}

export class FormGetQueryDto {
  @ApiProperty({ required: false, default: true })
  @TransformBooleanString({ optional: true })
  translated?: boolean;
}
