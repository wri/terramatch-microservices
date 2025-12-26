import { ApiProperty } from "@nestjs/swagger";
import { Leadership } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";

// TODO most of these fields will migrate to a full response DTO when we need one.
export class EmbeddedLeadershipDto {
  constructor(leadership: Leadership) {
    populateDto<EmbeddedLeadershipDto>(this, leadership);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  collection: string;

  @ApiProperty({ nullable: true, type: String })
  nationality: string | null;

  @ApiProperty({ nullable: true, type: String })
  firstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  lastName: string | null;

  @ApiProperty({ nullable: true, type: String })
  position: string | null;

  @ApiProperty({ nullable: true, type: String })
  gender: string | null;

  @ApiProperty({ nullable: true, type: Number })
  age: number | null;
}
