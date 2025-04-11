import { IsBoolean, IsEnum, IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { ApiProperty, IntersectionType } from "@nestjs/swagger";

export class MediaQueryDto extends IntersectionType(NumberPage) {
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;

  @ApiProperty({ required: false })
  @IsOptional()
  modelType?: string;

  @IsOptional()
  @IsBoolean()
  isGeotagged?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  fileType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  isPrivate?: boolean;

  @ApiProperty({ name: "direction", required: false, enum: ["asc", "desc"], default: "asc" })
  @IsEnum(["asc", "desc"])
  @IsOptional()
  direction?: "asc" | "desc";
}
