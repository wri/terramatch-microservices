import { populateDto } from "./json-api-attributes";
import { Stakeholder } from "@terramatch-microservices/database/entities";
import {
  STAKEHOLDER_KEY_ROLES,
  StakeholderKeyRole
} from "@terramatch-microservices/database/entities/stakeholder.entity";
import { ApiProperty } from "@nestjs/swagger";

export class EmbeddedStakeholderDto {
  constructor(stakeholder: Stakeholder) {
    populateDto<EmbeddedStakeholderDto>(this, stakeholder);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String, enum: STAKEHOLDER_KEY_ROLES })
  keyRole: StakeholderKeyRole | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;
}
