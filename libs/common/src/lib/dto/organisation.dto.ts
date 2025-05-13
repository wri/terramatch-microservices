import { JsonApiDto } from "../decorators";
import { ApiProperty } from "@nestjs/swagger";

const STATUSES = ["draft", "pending", "approved", "rejected"];
type Status = (typeof STATUSES)[number];

@JsonApiDto({ type: "organisations" })
export class OrganisationDto {
  @ApiProperty({ enum: STATUSES })
  status: Status;

  @ApiProperty({ nullable: true })
  name: string | null;
}
