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
  Table
} from "sequelize-typescript";
import { BIGINT, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";
import { SitePolygon } from "./site-polygon.entity";
import { EntityStatus, UpdateRequestStatus } from "../constants/status";
import { SitingStrategy } from "../constants/entity-selects";
import { Seeding } from "./seeding.entity";

// Incomplete stub
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model<Site> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly APPROVED_STATUSES = ["approved", "restoration-in-progress"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\Site";

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
