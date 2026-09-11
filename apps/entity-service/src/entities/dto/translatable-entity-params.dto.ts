import { IsIn, IsString, ValidateIf } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { TRANSLATABLE_ENTITIES, TranslatableEntity } from "../entity-translations.service";

export class TranslatableEntityParamsDto {
  @IsIn(TRANSLATABLE_ENTITIES)
  @ApiProperty({
    enum: TRANSLATABLE_ENTITIES,
    required: true,
    description: "Translatable entity type (forms, fundingProgrammes, localizationKeys, or aboutSections)"
  })
  entity: TranslatableEntity;

  @ValidateIf(({ entity }) => entity !== "localizationKeys")
  @IsString()
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      "Entity UUID for forms, funding programmes, and about sections. Optional for localizationKeys (all keys are pushed/pulled)."
  })
  uuid?: string | null;
}
