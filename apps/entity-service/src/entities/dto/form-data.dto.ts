import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";
import { IsNotEmptyObject } from "class-validator";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { Dictionary } from "lodash";

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
  frameworkKey: string | null;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, isArray: true, type: String })
  feedbackFields: string[] | null;

  @ApiProperty()
  answers: Dictionary<unknown>;
}

export class StoreFormDataAttributes {
  @IsNotEmptyObject()
  @ApiProperty()
  answers: Dictionary<unknown>;
}

export class UpdateFormDataBody extends JsonApiBodyDto(
  class UpdateFormDataData extends JsonApiDataDto({ type: "formData" }, StoreFormDataAttributes) {}
) {}
