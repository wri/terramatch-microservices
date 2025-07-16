import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Demographic, DemographicEntry } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "dashboardDemographics" })
export class DashboardDemographicEntryDto {
  constructor(data: DashboardDemographicEntryDto) {
    populateDto<DashboardDemographicEntryDto>(this, data);
  }

  @ApiProperty()
  type: string;

  @ApiProperty({ nullable: true, type: String })
  subtype: string | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty()
  amount: number;
}

@JsonApiDto({ type: "dashboardDemographics" })
export class DashboardDemographicDto {
  constructor(data: DashboardDemographicDto) {
    populateDto<DashboardDemographicDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: Demographic.VALID_TYPES })
  type: string;

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectName: string | null;

  @ApiProperty({ type: () => DashboardDemographicEntryDto, isArray: true })
  entries: DashboardDemographicEntryDto[];
}
