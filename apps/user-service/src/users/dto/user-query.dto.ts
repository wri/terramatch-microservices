import { IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class UserQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: "Filter users by email address verification status" })
  @IsOptional()
  @TransformBooleanString()
  isVerified?: boolean;
}
