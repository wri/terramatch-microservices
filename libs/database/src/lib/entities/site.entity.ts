import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import { BIGINT, literal, Op, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";
import { SitePolygon } from "./site-polygon.entity";
import { EntityStatus, UpdateRequestStatus } from "../constants/status";
import { SitingStrategy } from "../constants/entity-selects";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";
import { Framework } from "./framework.entity";
import { chainScope } from "../util/chainScope";

// Incomplete stub
@Scopes(() => ({
  approved: { where: { status: { [Op.in]: Site.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model<Site> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly APPROVED_STATUSES = ["approved", "restoration-in-progress"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\Site";

  static approved() {
    return chainScope(this, "approved") as typeof Site;
  }

  static project(id: number) {
    return chainScope(this, { method: ["project", id] }) as typeof Site;
  }

  static approvedIdsSubquery(projectId: number) {
    const attributes = Site.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Site.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.id.field} FROM ${Site.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.projectId.field} = ${sql.escape(projectId)}
        AND ${attributes.status.field} IN (${Site.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  static approvedUuidsSubquery(projectId: number) {
    const attributes = Site.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Site.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.uuid.field} FROM ${Site.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.projectId.field} = ${sql.escape(projectId)}
        AND ${attributes.status.field} IN (${Site.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  name: string;

  @Column(STRING)
  status: EntityStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @Index
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  framework: Framework | null;

  get frameworkUuid() {
    return this.framework?.uuid;
  }

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  @AllowNull
  @Column(STRING)
  sitingStrategy: SitingStrategy | null;

  @AllowNull
  @Column(TEXT)
  descriptionSitingStrategy: string | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Site.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Site.LARAVEL_TYPE, collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  async loadNonTrees() {
    this.nonTrees ??= await this.$get("nonTrees");
    return this.nonTrees;
  }

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedableType: Site.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;

  async loadSeedsPlanted() {
    this.seedsPlanted ??= await this.$get("seedsPlanted");
    return this.seedsPlanted;
  }

  @HasMany(() => SiteReport)
  reports: SiteReport[] | null;

  async loadReports() {
    this.reports ??= await this.$get("reports");
    return this.reports;
  }

  @HasMany(() => SitePolygon, { foreignKey: "siteUuid", sourceKey: "uuid" })
  sitePolygons: SitePolygon[] | null;

  async loadSitePolygons() {
    this.sitePolygons ??= await this.$get("sitePolygons");
    return this.sitePolygons;
  }
}
