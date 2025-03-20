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
import { BIGINT, DATE, INTEGER, Op, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { Site } from "./site.entity";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";
import { Literal } from "sequelize/types/utils";
import { COMPLETE_REPORT_STATUSES } from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";

type ApprovedIdsSubqueryOptions = {
  dueAfter?: string | Date;
  dueBefore?: string | Date;
};

// A quick stub for the research endpoints
@Scopes(() => ({
  incomplete: { where: { status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } } },
  sites: (ids: number[] | Literal) => ({ where: { siteId: { [Op.in]: ids } } }),
  approved: { where: { status: { [Op.in]: SiteReport.APPROVED_STATUSES } } },
  dueBefore: (date: Date | string) => ({ where: { dueAt: { [Op.lt]: date } } }),
  reportsTask: (taskId: number) => ({ where: { taskId: taskId } })
}))
@Table({ tableName: "v2_site_reports", underscored: true, paranoid: true })
export class SiteReport extends Model<SiteReport> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly PARENT_ID = "siteId";
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly UNSUBMITTED_STATUSES = ["due", "started"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\SiteReport";

  static incomplete() {
    return chainScope(this, "incomplete") as typeof SiteReport;
  }

  static sites(ids: number[] | Literal) {
    return chainScope(this, "sites", ids) as typeof SiteReport;
  }

  static approved() {
    return chainScope(this, "approved") as typeof SiteReport;
  }

  static dueBefore(date: Date | string) {
    return chainScope(this, "dueBefore", date) as typeof SiteReport;
  }

  static reportsTask(taskId: number) {
    return chainScope(this, "reportsTask", taskId) as typeof SiteReport;
  }

  static approvedIdsSubquery(siteIds: number[] | Literal, opts: ApprovedIdsSubqueryOptions = {}) {
    const builder = Subquery.select(SiteReport, "id").in("siteId", siteIds).in("status", SiteReport.APPROVED_STATUSES);
    if (opts.dueAfter != null) builder.gte("dueAt", opts.dueAfter);
    if (opts.dueBefore != null) builder.lt("dueAt", opts.dueBefore);
    return builder.literal;
  }

  static approvedIdsForTaskSubquery(taskId: number) {
    return Subquery.select(SiteReport, "id").eq("taskId", taskId).in("status", SiteReport.APPROVED_STATUSES).literal;
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
    scope: { speciesable_type: SiteReport.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: SiteReport.LARAVEL_TYPE, collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedable_type: SiteReport.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;
}
