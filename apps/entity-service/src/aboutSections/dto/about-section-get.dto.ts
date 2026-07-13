import { ApiProperty } from "@nestjs/swagger";
import {
  ABOUT_SECTION_TYPES,
  AboutSectionType
} from "@terramatch-microservices/database/entities/about-section.entity";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { IsIn, IsOptional } from "class-validator";

export class AboutSectionGetParamDto {
  @ApiProperty({ enum: ABOUT_SECTION_TYPES })
  type: AboutSectionType;
}

export class AboutSectionGetQueryDto {
  @ApiProperty({ enum: FRAMEWORK_KEYS, required: false })
  @IsOptional()
  @IsIn(FRAMEWORK_KEYS)
  framework: FrameworkKey;
}
