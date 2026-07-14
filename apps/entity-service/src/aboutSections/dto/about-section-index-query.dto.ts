import { ApiProperty } from "@nestjs/swagger";
import {
  ABOUT_SECTION_TYPES,
  AboutSectionType
} from "@terramatch-microservices/database/entities/about-section.entity";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { IsIn, IsOptional } from "class-validator";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";

export class AboutSectionIndexQueryDto extends IndexQueryDto {
  @ApiProperty({ enum: ABOUT_SECTION_TYPES, required: false })
  @IsOptional()
  @IsIn(ABOUT_SECTION_TYPES)
  type?: AboutSectionType;

  @ApiProperty({ enum: FRAMEWORK_KEYS, required: false })
  @IsOptional()
  @IsIn(FRAMEWORK_KEYS)
  framework?: FrameworkKey;
}
