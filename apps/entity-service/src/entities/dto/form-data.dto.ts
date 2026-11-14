import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ENTITY_TYPES } from "@terramatch-microservices/database/constants/entities";
import { IsIn, IsNotEmptyObject } from "class-validator";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { Dictionary } from "lodash";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { PROCESSABLE_ENTITIES } from "../entities.service";

export const FORM_DATA_ENTITY_TYPES = [...ENTITY_TYPES, "organisations"] as const;
export type FormDataEntityType = (typeof FORM_DATA_ENTITY_TYPES)[number];

const FORM_DATA_PARAM_TYPES = [...PROCESSABLE_ENTITIES, "organisations"] as const;

export class FormDataParamsDto extends SingleResourceDto {
  @IsIn(FORM_DATA_PARAM_TYPES)
  @ApiProperty({ enum: FORM_DATA_PARAM_TYPES, description: "Entity type for the form data" })
  entity: (typeof FORM_DATA_PARAM_TYPES)[number];
}

@JsonApiDto({ type: "formData", id: "string" })
export class FormDataDto {
  @ApiProperty({ enum: FORM_DATA_ENTITY_TYPES, description: "Entity type for this form data" })
  entityType: FormDataEntityType;

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
  class UpdateFormDataData extends JsonApiDataDto({ type: "formData", id: "string" }, StoreFormDataAttributes) {}
) {}
