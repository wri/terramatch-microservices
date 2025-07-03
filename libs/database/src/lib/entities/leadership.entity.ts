import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, STRING, TINYINT, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";

@Table({ tableName: "leaderships", underscored: true, paranoid: true })
export class Leadership extends Model<Leadership> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @BelongsTo(() => Organisation)
  organisation: Organisation | null;

  @Column(STRING)
  collection: string;

  @AllowNull
  @Column(STRING)
  firstName: string | null;

  @AllowNull
  @Column(STRING)
  lastName: string | null;

  @AllowNull
  @Column(STRING)
  position: string | null;

  @AllowNull
  @Column(STRING)
  gender: string | null;

  @AllowNull
  @Column(TINYINT.UNSIGNED)
  age: number | null;

  @AllowNull
  @Column(STRING)
  nationality: string | null;
}
