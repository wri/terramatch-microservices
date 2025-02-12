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

  static idsSubquery(demographicalIds: Literal, demographicalType: string, type: string) {
    const attributes = Demographic.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Demographic.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    return literal(
      `(SELECT ${attributes.id.field} FROM ${Demographic.tableName}
        WHERE ${attributes.demographicalType.field} = ${sql.escape(demographicalType)}
        AND ${attributes.demographicalId.field} IN ${demographicalIds.val}
        AND ${deletedAt} IS NULL
        AND ${attributes.hidden.field} = false
        AND ${attributes.type.field} = ${sql.escape(type)}
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
