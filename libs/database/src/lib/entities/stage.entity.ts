import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { FundingProgramme } from "./funding-programme.entity";

@Table({ tableName: "stages", underscored: true, paranoid: true })
export class Stage extends Model<InferAttributes<Stage>, InferCreationAttributes<Stage>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @Column(TINYINT.UNSIGNED)
  order: number;

  @Column(UUID)
  fundingProgrammeId: string;

  @BelongsTo(() => FundingProgramme, { foreignKey: "fundingProgrammeId", targetKey: "uuid", constraints: false })
  fundingProgramme: FundingProgramme | null;

  @AllowNull
  @Column(DATE)
  deadlineAt: Date | null;
}
