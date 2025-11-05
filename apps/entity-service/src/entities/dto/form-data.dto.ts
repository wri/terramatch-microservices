import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

export class FormDataGetParamsDto {
  @IsIn(ENTITY_TYPES)
  @ApiProperty({ enum: ENTITY_TYPES, description: "Entity type for form data" })
  entity: EntityType;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for form data" })
  uuid: string;
}

@JsonApiDto({ type: "formData" })
export class FormDataDto {
  @ApiProperty({ enum: ENTITY_TYPES, description: "Entity type for this form data" })
  entityType: EntityType;

  @ApiProperty({ description: "Entity UUID for this form data" })
  entityUuid: string;

  @ApiProperty()
  formUuid: string;

  @ApiProperty()
  formTitle: string;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, isArray: true, type: String })
  feedbackFields: string[] | null;
}
