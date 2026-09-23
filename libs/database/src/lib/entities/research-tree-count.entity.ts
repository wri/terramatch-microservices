import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, INTEGER, STRING } from "sequelize";
import { Project } from "./project.entity";

@Table({ tableName: "rs_tree_count", underscored: true, paranoid: true })
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
  declare verificationMethod: string;

  @Column(INTEGER)
  declare reportedCount: number;

  @Column(INTEGER)
  declare treeCountAdj: number;

  @Column(INTEGER)
  declare upperBounds: number;

  @Column(INTEGER)
  declare lowerBounds: number;
}
