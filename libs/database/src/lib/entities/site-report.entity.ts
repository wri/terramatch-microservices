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
import { BIGINT, DATE, INTEGER, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Site } from "./site.entity";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";

// A quick stub for the research endpoints
@Table({ tableName: "v2_site_reports", underscored: true, paranoid: true })
export class SiteReport extends Model<SiteReport> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly PARENT_ID = "siteId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\SiteReport";
  static readonly WORKDAY_COLLECTIONS = [
    "paid-site-establishment",
    "paid-planting",
    "paid-site-maintenance",
    "paid-site-monitoring",
    "paid-other-activities",
    "volunteer-site-establishment",
    "volunteer-planting",
    "volunteer-site-maintenance",
    "volunteer-site-monitoring",
    "volunteer-other-activities"
  ];

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @ForeignKey(() => Site)
  @Column(BIGINT.UNSIGNED)
  siteId: number;

  @BelongsTo(() => Site)
  site: Site | null;

  // TODO foreign key for task
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number;

  @Column(STRING)
  status: string;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: string;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @AllowNull
  @Column(DATE)
  submittedAt: Date | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  pctSurvivalToDate: number | null;

  @AllowNull
  @Column(TEXT)
  survivalCalculation: string | null;

  @AllowNull
  @Column(TEXT)
  survivalDescription: string | null;

  @AllowNull
  @Column(TEXT)
  maintenanceActivities: string | null;

  @AllowNull
  @Column(TEXT)
  regenerationDescription: string | null;

  @AllowNull
  @Column(TEXT)
  technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  publicNarrative: string | null;

  @AllowNull
  @Column(INTEGER)
  numTreesRegenerating: number | null;

  @AllowNull
  @Column(TEXT)
  soilWaterRestorationDescription: string | null;

  @AllowNull
  @Column(TEXT)
  waterStructures: string | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: SiteReport.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: SiteReport.LARAVEL_TYPE, collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  async loadNonTrees() {
    this.nonTrees ??= await this.$get("nonTrees");
    return this.nonTrees;
  }

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedableType: SiteReport.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;

  async loadSeedsPlanted() {
    this.seedsPlanted ??= await this.$get("seedsPlanted");
    return this.seedsPlanted;
  }
}
