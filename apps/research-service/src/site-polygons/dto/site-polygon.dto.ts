import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
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

  @ApiProperty({ example: 15000, nullable: true, type: Number })
  amount: number | null;
}

export class ReportingPeriodDto {
  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

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
      populateDto<SitePolygonLightDto, SitePolygon>(this, sitePolygon, {
        name: sitePolygon.polyName,
        siteId: sitePolygon.siteUuid,
        projectId: sitePolygon.site?.project?.uuid,
        projectShortName: sitePolygon.site?.project?.shortName,
        indicators: indicators ?? [],
        siteName: sitePolygon.site?.name,
        disturbanceableId: sitePolygon?.disturbance?.disturbanceableId ?? null,
        lightResource: true
      });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ enum: POLYGON_STATUSES })
  status: PolygonStatus;

  @ApiProperty({
    description: "If this ID points to a deleted site, the indicators will be empty.",
    nullable: true,
    type: String
  })
  siteId: string | null;

  @ApiProperty({
    description: "UUID of the associated polygon geometry",
    nullable: true,
    type: String
  })
  polygonUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectId?: string;

  @ApiProperty({ nullable: true, type: String })
  projectShortName?: string | null;

  @ApiProperty({ nullable: true, type: Date })
  plantStart: Date | null;

  @ApiProperty({ nullable: true, type: Number })
  calcArea: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Latitude of the site polygon"
  })
  lat: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Longitude of the site polygon"
  })
  long: number | null;

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

  @ApiProperty({ description: "The name of the associated Site.", nullable: true })
  siteName?: string;

  @ApiProperty({ nullable: true, type: String })
  versionName: string | null;

  @ApiProperty({ nullable: true, isArray: true, type: String })
  practice: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  targetSys: string | null;

  @ApiProperty({ nullable: true, isArray: true, type: String })
  distr: string[] | null;

  @ApiProperty({ nullable: true, type: Number })
  numTrees: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Source of the site polygon"
  })
  source: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Validation status of the site polygon",
    maxLength: 255
  })
  validationStatus: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Primary UUID of the site polygon"
  })
  primaryUuid: string | null;

  @ApiProperty({
    type: String,
    description: "UUID of the site polygon"
  })
  uuid: string;

  @ApiProperty({
    type: Number,
    nullable: true
  })
  disturbanceableId: number | null;

  @ApiProperty({
    type: Boolean,
    description: "Whether the site polygon is active"
  })
  isActive: boolean;
}

@JsonApiDto({ type: "sitePolygons" })
export class SitePolygonFullDto extends SitePolygonLightDto {
  constructor(
    sitePolygon: SitePolygon,
    indicators?: IndicatorDto[],
    establishmentTreeSpecies?: TreeSpeciesDto[],
    reportingPeriods?: ReportingPeriodDto[]
  ) {
    super();

    populateDto<SitePolygonFullDto, SitePolygon>(this, sitePolygon, {
      name: sitePolygon.polyName,
      siteId: sitePolygon.siteUuid,
      projectId: sitePolygon.site?.project?.uuid,
      projectShortName: sitePolygon.site?.project?.shortName,
      indicators: indicators ?? [],
      siteName: sitePolygon.site?.name,
      geometry: sitePolygon.polygon?.polygon,
      establishmentTreeSpecies: establishmentTreeSpecies ?? [],
      reportingPeriods: reportingPeriods ?? [],
      disturbanceableId: sitePolygon.disturbance?.disturbanceableId ?? null,
      lightResource: false
    });
  }

  @ApiProperty({ nullable: true })
  geometry?: Polygon;

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
