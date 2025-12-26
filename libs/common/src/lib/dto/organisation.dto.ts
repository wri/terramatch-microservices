/* istanbul ignore file */
import { JsonApiDto } from "../decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "./json-api-attributes";
import { Organisation } from "@terramatch-microservices/database/entities";

const STATUSES = ["draft", "pending", "approved", "rejected"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "organisations" })
export class OrganisationDto {
  constructor(org?: Organisation) {
    if (org != null) populateDto<OrganisationDto>(this, org);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: STATUSES })
  status: Status;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;
}
