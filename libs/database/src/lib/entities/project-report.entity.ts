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
import { TreeSpecies } from "./tree-species.entity";
import { Project } from "./project.entity";

// A quick stub for the tree endpoints
@Table({ tableName: "v2_project_reports", underscored: true, paranoid: true })
export class ProjectReport extends Model<ProjectReport> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  @AllowNull
  @Column(DATE)
  dueAt: Date | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    scope: { speciesableType: "App\\Models\\V2\\Projects\\ProjectReport", collection: "tree-planted" }
  })
  treeSpecies: TreeSpecies[] | null;
}
