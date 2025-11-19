import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class VersionUpdateAttributes {
  @ApiProperty({
    description: "Set to true to activate this version, false to deactivate",
    example: true
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    required: false,
    description: "Optional comment explaining the version change",
    example: "Activating this version to revert recent changes"
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class VersionUpdateBody extends JsonApiBodyDto(
  class VersionUpdateData extends JsonApiDataDto({ type: "sitePolygons" }, VersionUpdateAttributes) {}
) {}
