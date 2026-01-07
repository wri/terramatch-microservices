import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { JsonApiDto } from "../decorators/json-api-dto.decorator";

@JsonApiDto({ type: "formTranslations" })
export class FormTranslationDto {
  constructor(id: number) {
    this.i18nItemId = id;
  }

  @ApiProperty({ description: "I18n item ID" })
  @IsNumber()
  i18nItemId: number;
}
