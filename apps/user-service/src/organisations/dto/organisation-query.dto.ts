import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { IsIn, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class OrganisationIndexQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  fundingProgrammeUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  hqCountry?: string;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Return light resource instead of full resource"
  })
  @TransformBooleanString()
  lightResource?: boolean;

  @ApiProperty({
    required: false,
    description:
      "Public view: returns approved, non-private, non-test organisations. Forces status=approved. Use view=public."
  })
  @IsOptional()
  @IsIn(["public"])
  view?: "public";
}
