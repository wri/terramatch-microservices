import { ApiProperty } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { IsIn } from "class-validator";

export class PolygonAttributeDefinitionQueryDto {
  @IsIn(FRAMEWORK_KEYS)
  @ApiProperty({
    enum: FRAMEWORK_KEYS,
    description: "Framework slug. Required. Admin list includes inactive definitions."
  })
  frameworkKey: FrameworkKey;
}
