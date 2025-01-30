import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { Demographic } from "./demographic.entity";
import { BIGINT, BOOLEAN, STRING, TEXT, UUID } from "sequelize";

@Table({
  tableName: "restoration_partners",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "partner_morph_index", fields: ["partnerable_id", "partnerable_type"] }
  ]
})
export class RestorationPartner extends Model<RestorationPartner> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\RestorationPartners\\RestorationPartner";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @Column(STRING)
  partnerableType: string;

  @Column(BIGINT.UNSIGNED)
  partnerableId: number;

  @AllowNull
  @Column(TEXT)
  description: string;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @HasMany(() => Demographic, {
    foreignKey: "demographicalId",
    constraints: false,
    scope: { demographicalType: RestorationPartner.LARAVEL_TYPE }
  })
  demographics: Demographic[] | null;
}
