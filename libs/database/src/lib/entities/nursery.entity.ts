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
import { BIGINT, STRING, UUID } from "sequelize";
import { Project } from "./project.entity";
import { TreeSpecies } from "./tree-species.entity";
import { NurseryReport } from "./nursery-report.entity";

// Incomplete stub
@Table({ tableName: "v2_nurseries", underscored: true, paranoid: true })
export class Nursery extends Model<Nursery> {
  static readonly APPROVED_STATUSES = ["approved"];
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\Nursery";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  status: string;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: string;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Nursery.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  seedlings: TreeSpecies[] | null;

  @HasMany(() => NurseryReport)
  reports: NurseryReport[] | null;
}
