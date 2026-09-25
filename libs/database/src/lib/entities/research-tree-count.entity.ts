import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, INTEGER, STRING } from "sequelize";
import { Project } from "./project.entity";
import { VerificationMethod } from "../constants/research-tree-count";

@Table({
  tableName: "rs_tree_count",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names
  indexes: [{ name: "rs_tree_count_project_id_index", fields: ["project_id"] }]
})
export class ResearchTreeCount extends Model<
  InferAttributes<ResearchTreeCount>,
  InferCreationAttributes<ResearchTreeCount>
> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

  @BelongsTo(() => Project)
  declare project?: Project;

  @Column(STRING)
  declare verificationMethod: VerificationMethod;

  @Column(INTEGER)
  declare reportedCount: number;

  @AllowNull
  @Column(INTEGER)
  declare treeCountAdj: number | null;

  @Column(INTEGER)
  declare upperBounds: number;

  @Column(INTEGER)
  declare lowerBounds: number;
}
