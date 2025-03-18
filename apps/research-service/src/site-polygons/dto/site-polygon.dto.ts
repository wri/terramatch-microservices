import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";
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
import { Polygon } from "geojson";
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

export class ReportingPeriodDto {
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
export class SitePolygonLightDto extends HybridSupportDto {
  constructor(sitePolygon?: SitePolygon, indicators?: IndicatorDto[]) {
    super();
    if (sitePolygon != null) {
      this.populate(SitePolygonLightDto, {
        ...pickApiProperties(sitePolygon, SitePolygonLightDto),
        name: sitePolygon.polyName,
        siteId: sitePolygon.siteUuid,
        indicators: indicators,
        siteName: sitePolygon.site?.name
      });
    }
  }

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: POLYGON_STATUSES })
  status: PolygonStatus;

  @ApiProperty({ description: "If this ID points to a deleted site, the indicators will be empty." })
  siteId: string;

  @ApiProperty({ nullable: true })
  plantStart: Date | null;

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

  @ApiProperty({ description: "The name of the associated Site." })
  siteName: string;
}

export class SitePolygonFullDto extends SitePolygonLightDto {
  constructor(
    sitePolygon: SitePolygon,
    indicators: IndicatorDto[],
    establishmentTreeSpecies: TreeSpeciesDto[],
    reportingPeriods: ReportingPeriodDto[]
  ) {
    // Call super() without arguments
    super();

    if (sitePolygon != null) {
      this.populate(SitePolygonFullDto, {
        ...pickApiProperties(sitePolygon, SitePolygonFullDto),
        name: sitePolygon.polyName,
        siteId: sitePolygon.siteUuid,
        indicators: indicators,
        siteName: sitePolygon.site?.name,
        geometry: sitePolygon.polygon?.polygon,
        establishmentTreeSpecies,
        reportingPeriods,
        lightResource: false // This is a full resource
      });
    }
  }

  @ApiProperty({ nullable: true })
  plantEnd: Date | null;

  @ApiProperty()
  geometry: Polygon;

  @ApiProperty({ nullable: true })
  practice: string | null;

  @ApiProperty({ nullable: true })
  targetSys: string | null;

  @ApiProperty({ nullable: true })
  distr: string | null;

  @ApiProperty({ nullable: true })
  numTrees: number | null;

  @ApiProperty({
    type: () => TreeSpeciesDto,
    isArray: true,
    description: "The tree species associated with the establishment of the site that this polygon relates to."
  })
  establishmentTreeSpecies: TreeSpeciesDto[];

  @ApiProperty({
    type: () => ReportingPeriodDto,
    isArray: true,
    description: "Access to reported trees planted for each approved report on this site."
  })
  reportingPeriods: ReportingPeriodDto[];
}
