import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING, UUID, UUIDV4 } from "sequelize";
import { FrameworkKey } from "../constants";

@Table({ tableName: "frameworks", underscored: true })
export class Framework extends Model<InferAttributes<Framework>, InferCreationAttributes<Framework>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @AllowNull
  @Index
  @Column(STRING(20))
  declare slug: FrameworkKey | null;

  @Column(STRING)
  declare name: string;

  // @deprecated This column is superfluous, and while it's not enforced in code anywhere, some flows
  // around applications and funding programmes will break if the value of this column is different
  // from the slug.
  @AllowNull
  @Column(STRING(20))
  declare accessCode: string | null;

  @AllowNull
  @Column(UUID)
  declare projectFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  declare projectReportFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  declare siteFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  declare siteReportFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  declare nurseryFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  declare nurseryReportFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  declare financialReportFormUuid: string | null;
}
