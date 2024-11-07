import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
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

export class TreeSpeciesDto {
  @ApiProperty({ example: "Acacia binervia" })
  name: string;

  @ApiProperty({ example: 15000, nullable: true })
  amount: number | null;
}

class ReportingPeriod {
  @ApiProperty()
  dueAt: Date;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty({
    type: () => TreeSpeciesDto,
    isArray: true,
    description: "The tree species reported as planted during this reporting period"
  })
  treeSpecies: TreeSpeciesDto[];
}

@JsonApiDto({ type: "sitePolygons" })
export class SitePolygonDto extends JsonApiAttributes<SitePolygonDto> {
  constructor(sitePolygon: SitePolygon, indicators: IndicatorDto[], establishmentTreeSpecies: TreeSpeciesDto[]) {
    super({
      ...pickApiProperties(sitePolygon, SitePolygonDto),
      name: sitePolygon.polyName,
      siteId: sitePolygon.siteUuid,
      indicators,
      establishmentTreeSpecies,
      reportingPeriods: []
    });
  }

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: POLYGON_STATUSES })
  status: PolygonStatus;

  @ApiProperty()
  siteId: string;

  @ApiProperty({ nullable: true })
  plantStart: Date | null;

  @ApiProperty({ nullable: true })
  plantEnd: Date | null;

  @ApiProperty({ nullable: true })
  practice: string | null;

  @ApiProperty({ nullable: true })
  targetSys: string | null;

  @ApiProperty({ nullable: true })
  distr: string | null;

  @ApiProperty({ nullable: true })
  numTrees: number | null;

  @ApiProperty({ nullable: true })
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
    type: () => TreeSpeciesDto,
    isArray: true,
    description: "The tree species associated with the establishment of the site that this polygon relates to."
  })
  establishmentTreeSpecies: TreeSpeciesDto[];

  @ApiProperty({
    type: () => ReportingPeriod,
    isArray: true,
    description: "Access to reported trees planted for each approved report on this site."
  })
  reportingPeriods: ReportingPeriod[];
}
