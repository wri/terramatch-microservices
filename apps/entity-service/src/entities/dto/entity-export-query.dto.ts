import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";

export class EntityExportQueryDto {
  @ApiProperty({ required: false, enum: FRAMEWORK_KEYS })
  @IsOptional()
  frameworkKey?: FrameworkKey;
}
