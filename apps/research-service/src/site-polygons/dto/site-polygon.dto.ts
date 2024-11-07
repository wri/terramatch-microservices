import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto,
  IndicatorMsuCarbonDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto
} from "./indicators.dto";
import { POLYGON_STATUSES, PolygonStatus } from "@terramatch-microservices/database/constants";
import { SitePolygon } from "@terramatch-microservices/database/entities";

export type IndicatorDto =
  | IndicatorTreeCoverLossDto
  | IndicatorHectaresDto
  | IndicatorTreeCountDto
  | IndicatorTreeCoverDto
  | IndicatorFieldMonitoringDto
  | IndicatorMsuCarbonDto;

class TreeSpecies {
  @ApiProperty({ example: "Acacia binervia" })
  name: string;

  @ApiProperty({ example: 15000 })
  amount: number;
}

class ReportingPeriod {
  @ApiProperty()
  dueAt: Date;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty({
    type: () => TreeSpecies,
    isArray: true,
    description: "The tree species reported as planted during this reporting period"
  })
  treeSpecies: TreeSpecies[];
}

@JsonApiDto({ type: "sitePolygons" })
export class SitePolygonDto extends JsonApiAttributes<SitePolygonDto> {
  constructor(sitePolygon: SitePolygon, indicators: IndicatorDto[]) {
    super({
      ...sitePolygon,
      name: sitePolygon.polyName,
      siteId: sitePolygon.siteUuid,
      indicators,
      establishmentTreeSpecies: [],
      reportingPeriods: []
    });
  }

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: POLYGON_STATUSES })
  status: PolygonStatus;

  @ApiProperty()
  siteId: string;

  @ApiProperty()
  plantStart: Date | null;

  @ApiProperty()
  plantEnd: Date | null;

  @ApiProperty()
  practice: string | null;

  @ApiProperty()
  targetSys: string | null;

  @ApiProperty()
  distr: string | null;

  @ApiProperty()
  numTrees: number | null;

  @ApiProperty()
  calcArea: number | null;

  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: "#/components/schemas/IndicatorTreeCoverLossDto" },
        { $ref: "#/components/schemas/IndicatorHectaresDto" },
        { $ref: "#/components/schemas/IndicatorTreeCountDto" },
        { $ref: "#/components/schemas/IndicatorTreeCoverDto" },
        { $ref: "#/components/schemas/IndicatorFieldMonitoringDto" },
        { $ref: "#/components/schemas/IndicatorMsuCarbonDto" }
      ]
    },
    description: "All indicators currently recorded for this site polygon"
  })
  indicators: IndicatorDto[];

  @ApiProperty({
    type: () => TreeSpecies,
    isArray: true,
    description: "The tree species associated with the establishment of the site that this polygon relates to."
  })
  establishmentTreeSpecies: TreeSpecies[];

  @ApiProperty({
    type: () => ReportingPeriod,
    isArray: true,
    description: "Access to reported trees planted for each approved report on this site."
  })
  reportingPeriods: ReportingPeriod[];
}
