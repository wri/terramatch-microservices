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
import { BIGINT, DATE, INTEGER, STRING, UUID } from "sequelize";
import { Nursery } from "./nursery.entity";
import { TreeSpecies } from "./tree-species.entity";
import { ReportStatus, UpdateRequestStatus } from "../constants/status";
import { FrameworkKey } from "../constants/framework";

// Incomplete stub
@Table({ tableName: "v2_nursery_reports", underscored: true, paranoid: true })
export class NurseryReport extends Model<NurseryReport> {
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly PARENT_ID = "nurseryId";
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\NurseryReport";

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

  @ForeignKey(() => Nursery)
  @Column(BIGINT.UNSIGNED)
  nurseryId: number;

  @BelongsTo(() => Nursery)
  nursery: Nursery | null;

  // TODO foreign key for task
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  taskId: number;

  @Column(STRING)
  status: ReportStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seedlingsYoungTrees: number | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: NurseryReport.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  seedlings: TreeSpecies[] | null;
}
