import { BelongsTo, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DATE, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";

@Table({ tableName: "impact_stories", underscored: true, paranoid: true })
export class ImpactStory extends Model<ImpactStory> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\ImpactStory";

  static readonly MEDIA = {
    thumbnail: { dbCollection: "thumbnail", multiple: false }
  } as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(STRING)
  title: string;

  @Column(STRING)
  status: string | null;

  @Column(BIGINT.UNSIGNED)
  organizationId: number;

  @BelongsTo(() => Organisation, { foreignKey: "organizationId", constraints: false })
  organisation: Organisation;

  @Column(DATE)
  date: string | null;

  @Column(TEXT)
  category: string | null;

  @Column(STRING)
  thumbnail: string | null;

  @Column(TEXT)
  content: string | null;
}
