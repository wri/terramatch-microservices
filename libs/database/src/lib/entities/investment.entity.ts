import { AutoIncrement, BelongsTo, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DATE, STRING, UUID, UUIDV4 } from "sequelize";
import { Project } from "./project.entity";

@Table({ tableName: "investments", underscored: true, paranoid: true })
export class Investment extends Model<Investment> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

  @BelongsTo(() => Project, { constraints: false })
  declare project: Project | null;

  @Column(DATE)
  declare investmentDate: Date;

  @Column(STRING)
  declare type: string;
}
