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
import { BIGINT, Op, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";
import { SitePolygon } from "./site-polygon.entity";
import { APPROVED, RESTORATION_IN_PROGRESS, SiteStatus, UpdateRequestStatus } from "../constants/status";
import { SitingStrategy } from "../constants/entity-selects";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";
import { Framework } from "./framework.entity";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";

// Incomplete stub
@Scopes(() => ({
  approved: { where: { status: { [Op.in]: Site.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model<Site> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly APPROVED_STATUSES = [APPROVED, RESTORATION_IN_PROGRESS];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\Site";

  static approved() {
    return chainScope(this, "approved") as typeof Site;
  }

  static project(id: number) {
    return chainScope(this, "project", id) as typeof Site;
  }

  static approvedIdsSubquery(projectId: number) {
    return Subquery.select(Site, "id").eq("projectId", projectId).in("status", Site.APPROVED_STATUSES).literal;
  }

  static approvedUuidsSubquery(projectId: number) {
    return Subquery.select(Site, "uuid").eq("projectId", projectId).in("status", Site.APPROVED_STATUSES).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  name: string;

  @Column(STRING)
  status: SiteStatus;

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

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedableType: Site.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;

  @HasMany(() => SiteReport)
  reports: SiteReport[] | null;

  async loadReports() {
    this.reports ??= await this.$get("reports");
    return this.reports;
  }

  @HasMany(() => SitePolygon, { foreignKey: "siteUuid", sourceKey: "uuid" })
  sitePolygons: SitePolygon[] | null;
}
