import { ApiProperty } from "@nestjs/swagger";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class FormPullTranslationQueryDto {
  @ApiProperty({
    required: false,
    default: false,
    description: "If true, all translations will be pulled, otherwise only new translations will be pulled"
  })
  @TransformBooleanString({ optional: true })
  forceAll = false;
}
