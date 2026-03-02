/* istanbul ignore file */
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "../decorators";
import { OrganisationInvite } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";

@JsonApiDto({ type: "organisationInvites" })
export class OrganisationInviteDto {
  constructor(invite: OrganisationInvite) {
    populateDto<OrganisationInviteDto, OrganisationInvite>(this, invite, {});
  }

  @ApiProperty({ description: "Primary key of the organisation invite." })
  id: number;

  @ApiProperty({ description: "UUID of the organisation invite." })
  uuid: string;

  @ApiProperty({ description: "ID of the organisation this invite belongs to." })
  organisationId: number;

  @ApiProperty({ description: "Email address this invite was sent to." })
  emailAddress: string;

  @ApiProperty({ description: "Timestamp when the invite was accepted.", nullable: true, type: String })
  acceptedAt: Date | null;
}
