import { ApiProperty } from "@nestjs/swagger";
import { getSchemaPath } from "@nestjs/swagger";
import { JsonApiDto } from "../decorators";
import { populateDto } from "./json-api-attributes";
import { Action } from "@terramatch-microservices/database/entities";
import { ENTITY_TYPES, EntityType } from "@terramatch-microservices/database/constants/entities";

// Type for target - can be a LightDto object or EntityType string
export type ActionTarget = object | EntityType;

@JsonApiDto({ type: "actions" })
export class ActionDto {
  constructor(action: Action, target?: ActionTarget, targetableType?: EntityType | null) {
    populateDto<ActionDto, Action>(this, action, {
      target: target ?? (action.targetableType as EntityType)
    });
    // Override targetableType if provided (since it exists in Action, we can't use AdditionalProps)
    if (targetableType != null) {
      this.targetableType = targetableType;
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  status: string | null;

  @ApiProperty({ description: "Simplified targetable type (e.g., 'Project', 'ProjectReport')" })
  targetableType: string;

  @ApiProperty()
  targetableId: number;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  subtype: string | null;

  @ApiProperty({ nullable: true, type: String })
  key: string | null;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  subTitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  text: string | null;

  @ApiProperty({
    description: "Target entity (LightDto object or EntityType string)",
    oneOf: [{ type: "string", enum: [...ENTITY_TYPES] }]
  })
  target: ActionTarget;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
