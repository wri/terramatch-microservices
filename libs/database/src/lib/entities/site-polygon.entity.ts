import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Default,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, DOUBLE, INTEGER, STRING, UUID } from "sequelize";
import { Site } from "./site.entity";
import { PointGeometry } from "./point-geometry.entity";
import { PolygonGeometry } from "./polygon-geometry.entity";
import { User } from "./user.entity";
import { INDICATOR_SLUGS, POLYGON_STATUSES, PolygonStatus } from "../constants";
import { IndicatorOutputFieldMonitoring } from "./indicator-output-field-monitoring.entity";
import { IndicatorOutputHectares } from "./indicator-output-hectares.entity";
import { IndicatorOutputMsuCarbon } from "./indicator-output-msu-carbon.entity";
import { IndicatorOutputTreeCount } from "./indicator-output-tree-count.entity";
import { IndicatorOutputTreeCover } from "./indicator-output-tree-cover.entity";
import { IndicatorOutputTreeCoverLoss } from "./indicator-output-tree-cover-loss.entity";

export type Indicator =
  | IndicatorOutputTreeCoverLoss
  | IndicatorOutputHectares
  | IndicatorOutputTreeCount
  | IndicatorOutputTreeCover
  | IndicatorOutputFieldMonitoring
  | IndicatorOutputMsuCarbon;

@Table({ tableName: "site_polygon", underscored: true, paranoid: true })
export class SitePolygon extends Model<SitePolygon> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Column(UUID)
  primaryUuid: string;

  // This column got called site_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "site_id" })
  siteUuid: string;

  @BelongsTo(() => Site, { foreignKey: "siteUuid", targetKey: "uuid" })
  site: Site | null;

  async loadSite() {
    if (this.site == null && this.siteUuid != null) {
      this.site = await this.$get("site");
    }
    return this.site;
  }

  // This column got called point_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "point_id" })
  pointUuid: string;

  @BelongsTo(() => PointGeometry, { foreignKey: "pointUuid", targetKey: "uuid" })
  point: PointGeometry | null;

  async loadPoint() {
    if (this.point == null && this.pointUuid != null) {
      this.point = await this.$get("point");
    }
    return this.point;
  }

  // This column got called poly_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "poly_id" })
  polygonUuid: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polygonUuid", targetKey: "uuid" })
  polygon: PolygonGeometry | null;

  async loadPolygon() {
    if (this.polygon == null && this.polygonUuid != null) {
      this.polygon = await this.$get("polygon");
    }
    return this.polygon;
  }

  @AllowNull
  @Column(STRING)
  polyName: string | null;

  @AllowNull
  @Column({ type: DATE, field: "plantstart" })
  plantStart: Date | null;

  @AllowNull
  @Column({ type: DATE, field: "plantend" })
  plantEnd: Date | null;

  @AllowNull
  @Column(STRING)
  practice: string | null;

  @AllowNull
  @Column(STRING)
  targetSys: string | null;

  @AllowNull
  @Column(STRING)
  distr: string | null;

  @AllowNull
  @Column(INTEGER)
  numTrees: number | null;

  @AllowNull
  @Column(DOUBLE)
  calcArea: number | null;

  @AllowNull
  @Column({ type: STRING, values: POLYGON_STATUSES })
  status: PolygonStatus | null;

  @AllowNull
  @Column(STRING)
  source: string | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  @Default(false)
  @Column(BOOLEAN)
  isActive: boolean;

  @AllowNull
  @Column(STRING)
  versionName: string | null;

  @HasMany(() => IndicatorOutputFieldMonitoring)
  indicatorsFieldMonitoring: IndicatorOutputFieldMonitoring[] | null;

  @HasMany(() => IndicatorOutputHectares)
  indicatorsHectares: IndicatorOutputHectares[] | null;

  @HasMany(() => IndicatorOutputMsuCarbon)
  indicatorsMsuCarbon: IndicatorOutputMsuCarbon[] | null;

  @HasMany(() => IndicatorOutputTreeCount)
  indicatorsTreeCount: IndicatorOutputTreeCount[] | null;

  @HasMany(() => IndicatorOutputTreeCover)
  indicatorsTreeCover: IndicatorOutputTreeCover[] | null;

  @HasMany(() => IndicatorOutputTreeCoverLoss)
  indicatorsTreeCoverLoss: IndicatorOutputTreeCoverLoss[] | null;

  private _indicators: Indicator[] | null;
  async getIndicators(refresh = false) {
    if (!refresh && this._indicators != null) return this._indicators;

    if (refresh || this.indicatorsFieldMonitoring == null) {
      this.indicatorsFieldMonitoring = await this.$get("indicatorsFieldMonitoring");
    }
    if (refresh || this.indicatorsHectares == null) {
      this.indicatorsHectares = await this.$get("indicatorsHectares");
    }
    if (refresh || this.indicatorsMsuCarbon == null) {
      this.indicatorsMsuCarbon = await this.$get("indicatorsMsuCarbon");
    }
    if (refresh || this.indicatorsTreeCount == null) {
      this.indicatorsTreeCount = await this.$get("indicatorsTreeCount");
    }
    if (refresh || this.indicatorsTreeCover == null) {
      this.indicatorsTreeCover = await this.$get("indicatorsTreeCover");
    }
    if (refresh || this.indicatorsTreeCoverLoss == null) {
      this.indicatorsTreeCoverLoss = await this.$get("indicatorsTreeCoverLoss");
    }

    this._indicators = [
      ...(this.indicatorsFieldMonitoring ?? []),
      ...(this.indicatorsHectares ?? []),
      ...(this.indicatorsMsuCarbon ?? []),
      ...(this.indicatorsTreeCount ?? []),
      ...(this.indicatorsTreeCover ?? []),
      ...(this.indicatorsTreeCoverLoss ?? [])
    ];
    this._indicators.sort((indicatorA, indicatorB) => {
      const indexA = INDICATOR_SLUGS.indexOf(indicatorA.indicatorSlug);
      const indexB = INDICATOR_SLUGS.indexOf(indicatorB.indicatorSlug);
      return indexA < indexB ? -1 : indexB < indexA ? 1 : 0;
    });

    return this._indicators;
  }
}
