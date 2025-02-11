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
import { BIGINT, DATE, INTEGER, literal, Op, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Site } from "./site.entity";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";
import { Literal } from "sequelize/types/utils";
import { APPROVED_REPORT_STATUSES } from "../constants/status";

type ApprovedIdsSubqueryOptions = {
  dueAfterReplacement?: string;
  dueBeforeReplacement?: string;
};

// A quick stub for the research endpoints
@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: [APPROVED_REPORT_STATUSES] } } }
}))
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

  static approvedIdsSubquery(siteIds: Literal, opts: ApprovedIdsSubqueryOptions = {}) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const deletedAt = SiteReport.getAttributes().deletedAt!.field;
    let where = `WHERE ${deletedAt} IS NULL
      AND ${SiteReport.getAttributes().siteId.field} IN ${siteIds.val}
      AND ${SiteReport.getAttributes().status.field} IN (${SiteReport.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})`;
    if (opts.dueAfterReplacement != null) {
      where = `${where} AND ${SiteReport.getAttributes().dueAt.field} >= ${opts.dueAfterReplacement}`;
    }
    if (opts.dueBeforeReplacement != null) {
      where = `${where} AND ${SiteReport.getAttributes().dueAt.field} < ${opts.dueBeforeReplacement}`;
    }
    return literal(`(SELECT ${SiteReport.getAttributes().id.field} FROM ${SiteReport.tableName} ${where})`);
  }

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
  @Column(INTEGER({ unsigned: true, length: 10 }))
  workdaysPaid: number | null;

  @AllowNull
  @Column(INTEGER({ unsigned: true, length: 10 }))
  workdaysVolunteer: number | null;

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
