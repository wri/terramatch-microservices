import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Leadership } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "../decorators";
import { HybridSupportProps } from "./hybrid-support.dto";

@JsonApiDto({ type: "leaderships" })
export class LeadershipDto extends AssociationDto {
  constructor(leadership?: Leadership, props?: HybridSupportProps<LeadershipDto, Leadership>) {
    super();
    if (leadership != null && props != null) {
      populateDto<LeadershipDto, Leadership>(this, leadership, props);
    }
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

export class EmbeddedLeadershipDto extends OmitType(LeadershipDto, ["entityType", "entityUuid"]) {
  constructor(leadership: Leadership) {
    super();
    populateDto<EmbeddedLeadershipDto>(this, leadership);
  }
}
