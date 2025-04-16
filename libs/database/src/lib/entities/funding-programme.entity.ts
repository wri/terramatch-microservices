import { AllowNull, AutoIncrement, BelongsTo, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, UUID } from "sequelize";
import { FrameworkKey } from "../constants/framework";
import { Framework } from "./framework.entity";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "funding_programmes", underscored: true, paranoid: true })
export class FundingProgramme extends Model<FundingProgramme> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  name: string;

  @AllowNull
  @Column(INTEGER)
  nameId: number | null;

  // TODO after TM-1861 is merged
  // @BelongsTo(() => I18nItem, { foreignKey: "name_id", constraints: false })
  // nameI18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  framework: Framework | null;

  @Column({ type: STRING(30), defaultValue: "active" })
  status: string;

  @Column(TEXT)
  description: string;

  @AllowNull
  @Column(INTEGER)
  descriptionId: number | null;

  // TODO after TM-1861 is merged
  // @BelongsTo(() => I18nItem, { foreignKey: "description_id", constraints: false })
  // descriptionI18nItem: I18nItem | null;

  @AllowNull
  @Column(TEXT)
  location: string | null;

  @AllowNull
  @Column(TEXT)
  readMoreUrl: string | null;

  @AllowNull
  @JsonColumn()
  organisationTypes: string[] | null;

  @AllowNull
  @Column(INTEGER)
  locationId: number | null;

  // TODO after TM-1861 is merged
  // @BelongsTo(() => I18nItem, { foreignKey: "location_id", constraints: false })
  // locationI18nItem: I18nItem | null;
}
