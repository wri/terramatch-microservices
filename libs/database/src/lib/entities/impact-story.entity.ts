import { AutoIncrement, BelongsTo, Column, DataType, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DATE, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { MediaConfiguration } from "../constants/media-owners";
import { removeMedia } from "../hooks/remove-media";

type ImpactStoryMedia = "thumbnail";

@Table({ tableName: "impact_stories", underscored: true, paranoid: true, hooks: { afterDestroy: removeMedia } })
export class ImpactStory extends Model<ImpactStory> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\ImpactStory";

  static readonly MEDIA: Record<ImpactStoryMedia, MediaConfiguration> = {
    thumbnail: { dbCollection: "thumbnail", multiple: false, validation: "logo-image" }
  };

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Column({ type: DataType.STRING(71) })
  declare title: string;

  @Column(STRING)
  declare status: string;

  @Column(BIGINT.UNSIGNED)
  declare organizationId: number;

  @BelongsTo(() => Organisation, { foreignKey: "organizationId", constraints: false })
  declare organisation: Organisation;

  @Column(DATE)
  declare date: string;

  @JsonColumn()
  declare category: string[];

  @Column(STRING)
  declare thumbnail: string;

  @Column(TEXT)
  declare content: string;
}
