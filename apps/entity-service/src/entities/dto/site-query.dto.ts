import { ApiProperty } from "@nestjs/swagger";
import { EntityQueryDto } from "./entity-query.dto";
import { IsOptional } from "class-validator";

export class SiteQueryDto extends EntityQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;
}
