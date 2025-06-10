import { BelongsTo, AutoIncrement, Column, Index, Model, PrimaryKey, Table, DataType } from "sequelize-typescript";
import { BIGINT, DATE, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "impact_stories", underscored: true, paranoid: true })
export class ImpactStory extends Model<ImpactStory> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\ImpactStory";

  static readonly MEDIA = {
    thumbnail: { dbCollection: "thumbnail", multiple: false, validation: "logo-image" }
  } as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column({
    type: DataType.STRING(71)
  })
  title: string;

  @Column(STRING)
  status: string;

  @Column(BIGINT.UNSIGNED)
  organizationId: number;

  @BelongsTo(() => Organisation, { foreignKey: "organizationId", constraints: false })
  organisation: Organisation;

  @Column(DATE)
  date: string;

  @JsonColumn()
  category: string;

  @Column(STRING)
  thumbnail: string;

  @Column(TEXT)
  content: string;
}
