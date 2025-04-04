import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING, TEXT, UUID } from "sequelize";
import { DemographicEntry } from "./demographic-entry.entity";
import { Literal } from "sequelize/types/utils";
import { Subquery } from "../util/subquery.builder";
import { DemographicType } from "../types/demographic";

@Table({
  tableName: "demographics",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "demographics_morph_index", fields: ["demographical_id", "demographical_type"] }
  ]
})
export class Demographic extends Model<Demographic> {
  static readonly DEMOGRAPHIC_COUNT_CUTOFF = "2024-07-05";

  static readonly WORKDAYS_TYPE = "workdays";
  static readonly RESTORATION_PARTNERS_TYPE = "restoration-partners";
  static readonly JOBS_TYPE = "jobs";
  static readonly EMPLOYEES_TYPE = "employees";
  static readonly VOLUNTEERS_TYPE = "volunteers";
  static readonly ALL_BENEFICIARIES_TYPE = "all-beneficiaries";
  static readonly TRAINING_BENEFICIARIES_TYPE = "training-beneficiaries";
  static readonly INDIRECT_BENEFICIARIES_TYPE = "indirect-beneficiaries";
  static readonly VALID_TYPES = [
    Demographic.WORKDAYS_TYPE,
    Demographic.RESTORATION_PARTNERS_TYPE,
    Demographic.JOBS_TYPE,
    Demographic.EMPLOYEES_TYPE,
    Demographic.VOLUNTEERS_TYPE,
    Demographic.ALL_BENEFICIARIES_TYPE,
    Demographic.TRAINING_BENEFICIARIES_TYPE,
    Demographic.INDIRECT_BENEFICIARIES_TYPE
  ] as const;

  static idsSubquery(demographicalIds: Literal, demographicalType: string, type: DemographicType) {
    return Subquery.select(Demographic, "id")
      .eq("demographicalType", demographicalType)
      .in("demographicalId", demographicalIds)
      .eq("hidden", false)
      .eq("type", type).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  type: string;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @Column(STRING)
  demographicalType: string;

  @Column(BIGINT.UNSIGNED)
  demographicalId: number;

  @AllowNull
  @Column(TEXT)
  description: string;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @HasMany(() => DemographicEntry, { constraints: false })
  entries: DemographicEntry[] | null;
}
