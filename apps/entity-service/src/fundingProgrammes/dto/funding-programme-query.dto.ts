import { ApiProperty } from "@nestjs/swagger";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class FundingProgrammeQueryDto {
  @ApiProperty({ required: false, default: true })
  @TransformBooleanString({ optional: true })
  translated?: boolean;
}
