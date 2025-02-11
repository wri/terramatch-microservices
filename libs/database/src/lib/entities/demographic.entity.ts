import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, BOOLEAN, literal, STRING, TEXT, UUID } from "sequelize";
import { DemographicEntry } from "./demographic-entry.entity";
import { Literal } from "sequelize/types/utils";

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

  static idsSubquery(demographicalIds: Literal, demographicalTypeReplacement: string, typeReplacement: string) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const deletedAt = Demographic.getAttributes().deletedAt!.field;
    return literal(
      `(SELECT ${Demographic.getAttributes().id.field} FROM ${Demographic.tableName}
        WHERE ${Demographic.getAttributes().demographicalType.field} = ${demographicalTypeReplacement}
        AND ${Demographic.getAttributes().demographicalId.field} IN ${demographicalIds.val}
        AND ${deletedAt} IS NULL
        AND ${Demographic.getAttributes().hidden.field} = false
        AND ${Demographic.getAttributes().type.field} = ${typeReplacement}
      )`
    );
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
