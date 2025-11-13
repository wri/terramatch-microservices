import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

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

export class VersionUpdateData {
  @Equals("sitePolygons")
  @ApiProperty({ enum: ["sitePolygons"] })
  type: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({ format: "uuid", required: false, description: "Optional - defaults to UUID from path parameter" })
  id?: string;

  @ValidateNested()
  @Type(() => VersionUpdateAttributes)
  @ApiProperty({ type: () => VersionUpdateAttributes })
  attributes: VersionUpdateAttributes;
}

export class VersionUpdateRequestDto {
  @ValidateNested()
  @Type(() => VersionUpdateData)
  @ApiProperty({ type: () => VersionUpdateData })
  data: VersionUpdateData;
}
