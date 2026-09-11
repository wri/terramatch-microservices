import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsUUID } from "class-validator";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";

export class EntityExportQueryDto {
  @ApiProperty({
    required: false,
    enum: FRAMEWORK_KEYS,
    description: "Filter by framework. If projectUuid is provided, this is ignored."
  })
  @IsOptional()
  frameworkKey?: FrameworkKey;

  @ApiProperty({ required: false, type: String, description: "Filter by project" })
  @IsOptional()
  projectUuid?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: "Filter by specific entity UUIDs. When provided, frameworkKey and projectUuid are ignored."
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  uuids?: string[];
}
