import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Op,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { FrameworkKey } from "../constants";

export type FrameworkFormUuidAttribute = Extract<keyof Framework, `${string}FormUuid`>;

@Table({ tableName: "frameworks", underscored: true })
export class Framework extends Model<InferAttributes<Framework>, InferCreationAttributes<Framework>> {
  /**
   * Returns true if the framework with the given slug has a form set for the given form attribute.
   * Frameworks are not required to have reporting forms; report generation should be skipped for
   * any report type that does not have a form.
   */
  static async hasForm(slug: string | null, formAttribute: FrameworkFormUuidAttribute) {
    if (slug == null) return false;
    return (await Framework.count({ where: { slug, [formAttribute]: { [Op.ne]: null } } })) > 0;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @AllowNull
  @Index
  @Column(STRING)
  declare slug: FrameworkKey | null;

  @Column(STRING)
  declare name: string;

  // @deprecated This column is superfluous, and while it's not enforced in code anywhere, some flows
  // around applications and funding programmes will break if the value of this column is different
  // from the slug.
  @AllowNull
  @Column(STRING)
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

  @AllowNull
  @Column(UUID)
  declare disturbanceReportFormUuid: string | null;
}
