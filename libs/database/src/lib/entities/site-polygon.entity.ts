import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Default,
  ForeignKey,
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
import { POLYGON_STATUSES, PolygonStatus } from "../constants";

@Table({ tableName: "site_polygon", underscored: true, paranoid: true })
export class SitePolygon extends Model {
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
}
