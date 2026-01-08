import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { JsonApiDto } from "../decorators/json-api-dto.decorator";

@JsonApiDto({ type: "formTranslations" })
export class FormTranslationDto {
  constructor(translationKeysNumber: number) {
    this.translationKeysNumber = translationKeysNumber;
    this.lightResource = true;
  }

  @ApiProperty({ description: "Number of translation keys" })
  @IsNumber()
  translationKeysNumber: number;

  @ApiProperty({
    type: Boolean,
    description: "Indicates if this resource has the full resource definition."
  })
  lightResource: boolean;
}
