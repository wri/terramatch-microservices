import { AutoIncrement, BelongsTo, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DATE, STRING, UUID, UUIDV4 } from "sequelize";
import { Project } from "./project.entity";

@Table({ tableName: "investments", underscored: true, paranoid: true })
export class Investment extends Model<Investment> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project, { constraints: false })
  project: Project | null;

  @Column(DATE)
  investmentDate: Date;

  @Column(STRING)
  type: string;
}
