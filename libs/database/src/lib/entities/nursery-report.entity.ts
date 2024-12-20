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
import { BIGINT, DATE, UUID } from "sequelize";
import { Nursery } from "./nursery.entity";
import { TreeSpecies } from "./tree-species.entity";

// A quick stub for tree endpoints
@Table({ tableName: "v2_nursery_reports", underscored: true, paranoid: true })
export class NurseryReport extends Model<NurseryReport> {
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly PARENT_ID = "nurseryId";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @ForeignKey(() => Nursery)
  @Column(BIGINT.UNSIGNED)
  nurseryId: number;

  @BelongsTo(() => Nursery)
  nursery: Nursery | null;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: "App\\Models\\V2\\Nurseries\\NurseryReport", collection: "nursery-seedling" }
  })
  seedlings: TreeSpecies[] | null;
}
