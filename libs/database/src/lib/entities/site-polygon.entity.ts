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
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, DOUBLE, INTEGER, Op, STRING, UUID, UUIDV4 } from "sequelize";
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
import { Literal } from "sequelize/types/utils";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { PlantingStatus, PLANTING_STATUSES } from "../constants/planting-status";

export type Indicator =
  | IndicatorOutputTreeCoverLoss
  | IndicatorOutputHectares
  | IndicatorOutputTreeCount
  | IndicatorOutputTreeCover
  | IndicatorOutputFieldMonitoring
  | IndicatorOutputMsuCarbon;

@Scopes(() => ({
  active: { where: { isActive: true } },
  approved: { where: { status: "approved" } },
  sites: (uuids: string[] | Literal) => ({ where: { siteUuid: { [Op.in]: uuids } } })
}))
@Table({ tableName: "site_polygon", underscored: true, paranoid: true })
export class SitePolygon extends Model<SitePolygon> {
  static active() {
    return chainScope(this, "active") as typeof SitePolygon;
  }

  static approved() {
    return chainScope(this, "approved") as typeof SitePolygon;
  }

  static sites(uuids: string[] | Literal) {
    return chainScope(this, "sites", uuids) as typeof SitePolygon;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
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

  // This column got called poly_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "poly_id" })
  polygonUuid: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polygonUuid", targetKey: "uuid" })
  polygon: PolygonGeometry | null;

  @AllowNull
  @Column(STRING)
  polyName: string | null;

  @AllowNull
  @Column({ type: DATE, field: "plantstart" })
  plantStart: Date | null;

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
  @Column({ type: DOUBLE })
  lat: number | null;

  @AllowNull
  @Column({ type: DOUBLE })
  long: number | null;

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

  @AllowNull
  @Column({ type: STRING, values: PLANTING_STATUSES })
  plantingStatus: PlantingStatus | null;

  @AllowNull
  @Column({ type: STRING })
  validationStatus: string | null;

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
  async getIndicators() {
    if (this._indicators != null) return this._indicators;

    if (this.indicatorsFieldMonitoring == null) {
      this.indicatorsFieldMonitoring = await this.$get("indicatorsFieldMonitoring");
    }
    if (this.indicatorsHectares == null) {
      this.indicatorsHectares = await this.$get("indicatorsHectares");
    }
    if (this.indicatorsMsuCarbon == null) {
      this.indicatorsMsuCarbon = await this.$get("indicatorsMsuCarbon");
    }
    if (this.indicatorsTreeCount == null) {
      this.indicatorsTreeCount = await this.$get("indicatorsTreeCount");
    }
    if (this.indicatorsTreeCover == null) {
      this.indicatorsTreeCover = await this.$get("indicatorsTreeCover");
    }
    if (this.indicatorsTreeCoverLoss == null) {
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

  static siteUuidsForStatus(polygonStatus: string) {
    return Subquery.select(SitePolygon, "siteUuid").isNull("deletedAt").eq("isActive", true).eq("status", polygonStatus)
      .literal;
  }

  static siteUuidsWithPolygons() {
    return Subquery.select(SitePolygon, "siteUuid", { distinct: true }).isNull("deletedAt").eq("isActive", true)
      .literal;
  }
}
