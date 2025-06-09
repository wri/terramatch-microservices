import { AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUID, UUIDV4 } from "sequelize";

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

  // TODO: complete remaining fields
}
