import { IsOptional, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";
import { EntityQueryDto } from "./entity-query.dto";

export class MediaQueryDto extends EntityQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  modelType?: string;

  @ApiProperty({ required: false, default: false })
  @TransformBooleanString()
  isGeotagged?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  fileType?: string;

  @ApiProperty({ required: false, default: false })
  @TransformBooleanString()
  isPublic?: boolean;

  @ApiProperty({ required: false, default: false })
  @TransformBooleanString()
  isPrivate?: boolean;

  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, default: false })
  @TransformBooleanString()
  isCover?: boolean;
}

export class SingleMediaDto {
  @IsUUID()
  @ApiProperty({ description: "Media UUID for media to retrieve" })
  uuid: string;
}
