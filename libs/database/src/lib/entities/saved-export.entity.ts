import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING, UUID, UUIDV4 } from "sequelize";
import { FundingProgramme } from "./funding-programme.entity";

@Table({ tableName: "saved_exports", underscored: true })
export class SavedExport extends Model<InferAttributes<SavedExport>, InferCreationAttributes<SavedExport>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @ForeignKey(() => FundingProgramme)
  @Column(BIGINT.UNSIGNED)
  fundingProgrammeId: number;
}
