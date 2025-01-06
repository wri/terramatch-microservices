import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { Demographic } from "./demographic.entity";
import { BIGINT, BOOLEAN, STRING, TEXT, UUID } from "sequelize";

@Table({
  tableName: "v2_workdays",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "v2_workdays_morph_index", fields: ["workdayable_id", "workdayable_type"] }
  ]
})
export class Workday extends Model<Workday> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Workdays\\Workday";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  workdayableType: string;

  @Column(BIGINT.UNSIGNED)
  workdayableId: number;

  @AllowNull
  @Column(TEXT)
  description: string;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @HasMany(() => Demographic, {
    foreignKey: "demographicalId",
    constraints: false,
    scope: { demographicalType: Workday.LARAVEL_TYPE }
  })
  demographics: Demographic[] | null;
}
