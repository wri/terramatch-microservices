import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "frameworks", underscored: true })
export class Framework extends Model<Framework> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Index
  @Column(STRING(20))
  slug: string | null;

  @Column(STRING)
  name: string;

  // @deprecated This column is superfluous, and while it's not enforced in code anywhere, some flows
  // around applications and funding programmes will break if the value of this column is different
  // from the slug.
  @AllowNull
  @Column(STRING(20))
  accessCode: string | null;

  @AllowNull
  @Column(UUID)
  projectFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  projectReportFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  siteFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  siteReportFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  nurseryFormUuid: string | null;

  @AllowNull
  @Column(UUID)
  nurseryReportFormUuid: string | null;
}
