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
import { statusUpdateSequelizeHook } from "../constants/status";
import { Disturbance } from "./disturbance.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { InternalServerErrorException } from "@nestjs/common";

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
  sites: (uuids: string[] | Literal) => ({ where: { siteUuid: { [Op.in]: uuids } } }),
  forUuids: (uuids: string[] | Literal) => ({ where: { uuid: { [Op.in]: uuids } } }),
  disturbance: (disturbanceId: number) => ({ where: { disturbanceId } })
}))
@Table({
  tableName: "site_polygon",
  underscored: true,
  paranoid: true,
  // TODO: once status is updated to use a state machine as in the base entity models, this
  //  afterUpdate will probably need to be removed, as it will be handled by the state machine.
  hooks: { afterCreate: statusUpdateSequelizeHook, afterUpdate: statusUpdateSequelizeHook }
})
export class SitePolygon extends Model<SitePolygon> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\SitePolygon";

  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("SitePolygon model is missing sequelize connection");
    }
    return this.sequelize;
  }

  static active() {
    return chainScope(this, "active") as typeof SitePolygon;
  }

  static approved() {
    return chainScope(this, "approved") as typeof SitePolygon;
  }

  static disturbance(disturbanceId: number) {
    return chainScope(this, "disturbance", disturbanceId) as typeof SitePolygon;
  }

  static sites(uuids: string[] | Literal) {
    return chainScope(this, "sites", uuids) as typeof SitePolygon;
  }

  static forUuids(uuids: string[] | Literal) {
    return chainScope(this, "forUuids", uuids) as typeof SitePolygon;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Column(UUID)
  declare primaryUuid: string;

  // This column got called site_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "site_id" })
  declare siteUuid: string;

  @BelongsTo(() => Site, { foreignKey: "siteUuid", targetKey: "uuid" })
  declare site: Site | null;

  async loadSite() {
    if (this.site == null && this.siteUuid != null) {
      this.site = await this.$get("site");
    }
    return this.site;
  }

  // This column got called point_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "point_id" })
  declare pointUuid: string;

  @BelongsTo(() => PointGeometry, { foreignKey: "pointUuid", targetKey: "uuid" })
  declare point: PointGeometry | null;

  // This column got called poly_id in the PHP codebase, which is misleading because it's a UUID
  @AllowNull
  @Column({ type: UUID, field: "poly_id" })
  declare polygonUuid: string;

  @BelongsTo(() => PolygonGeometry, { foreignKey: "polygonUuid", targetKey: "uuid" })
  declare polygon: PolygonGeometry | null;

  @AllowNull
  @Column(STRING)
  declare polyName: string | null;

  @AllowNull
  @Column({ type: DATE, field: "plantstart" })
  declare plantStart: Date | null;

  @AllowNull
  @JsonColumn({ type: STRING })
  declare practice: string[] | null;

  @AllowNull
  @Column(STRING)
  declare targetSys: string | null;

  @AllowNull
  @JsonColumn({ type: STRING })
  declare distr: string[] | null;

  @AllowNull
  @Column(INTEGER)
  declare numTrees: number | null;

  @AllowNull
  @Column(DOUBLE)
  declare calcArea: number | null;

  @AllowNull
  @Column({ type: STRING, values: POLYGON_STATUSES })
  declare status: PolygonStatus | null;

  @AllowNull
  @Column({ type: DOUBLE })
  declare lat: number | null;

  @AllowNull
  @Column({ type: DOUBLE })
  declare long: number | null;

  @AllowNull
  @Column(STRING)
  declare source: string | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  @Default(false)
  @Column(BOOLEAN)
  declare isActive: boolean;

  @AllowNull
  @Column(STRING)
  declare versionName: string | null;

  @AllowNull
  @Column({ type: STRING })
  declare validationStatus: string | null;

  @ForeignKey(() => Disturbance)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare disturbanceId: number | null;

  @BelongsTo(() => Disturbance, { foreignKey: "disturbanceId", targetKey: "id" })
  declare disturbance: Disturbance | null;

  @HasMany(() => IndicatorOutputFieldMonitoring)
  declare indicatorsFieldMonitoring: IndicatorOutputFieldMonitoring[] | null;

  @HasMany(() => IndicatorOutputHectares)
  declare indicatorsHectares: IndicatorOutputHectares[] | null;

  @HasMany(() => IndicatorOutputMsuCarbon)
  declare indicatorsMsuCarbon: IndicatorOutputMsuCarbon[] | null;

  @HasMany(() => IndicatorOutputTreeCount)
  declare indicatorsTreeCount: IndicatorOutputTreeCount[] | null;

  @HasMany(() => IndicatorOutputTreeCover)
  declare indicatorsTreeCover: IndicatorOutputTreeCover[] | null;

  @HasMany(() => IndicatorOutputTreeCoverLoss)
  declare indicatorsTreeCoverLoss: IndicatorOutputTreeCoverLoss[] | null;

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
    return Subquery.select(SitePolygon, "siteUuid")
      .isNull("deletedAt")
      .isNotNull("siteUuid")
      .eq("isActive", true)
      .eq("status", polygonStatus).literal;
  }

  static siteUuidsWithPolygons() {
    return Subquery.select(SitePolygon, "siteUuid", { distinct: true })
      .isNull("deletedAt")
      .isNotNull("siteUuid")
      .eq("isActive", true).literal;
  }
}
