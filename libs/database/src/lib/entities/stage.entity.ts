import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  Op,
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

  /**
   * Resolves to true if this stage is not in a funding programme, or if it's the last stage in its funding programme.
   */
  async isFinalStage() {
    return (
      this.fundingProgramme == null ||
      (await Stage.count({
        where: { fundingProgrammeId: this.fundingProgrammeId, order: { [Op.gt]: this.order } }
      })) === 0
    );
  }
}
