import {
  AllowNull,
  AutoIncrement,
  Column,
  DefaultScope,
  ForeignKey,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DOUBLE, ENUM, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { User } from "./user.entity";
import { chainScope } from "../util/chain-scope";
import { LaravelModel, LaravelModelCtor } from "../types/util";

@DefaultScope(() => ({ order: ["orderColumn"] }))
@Scopes(() => ({
  collection: (collectionName: string) => ({ where: { collectionName } }),
  association: (association: LaravelModel) => ({
    where: {
      modelType: (association.constructor as LaravelModelCtor).LARAVEL_TYPE,
      modelId: association.id
    }
  })
}))
@Table({
  tableName: "media",
  underscored: true,
  // @Index doesn't work with underscored column names
  indexes: [
    { name: "media_model_type_model_id_index", fields: ["model_type", "model_id"] },
    { name: "media_order_column_index", fields: ["order_column"] }
  ]
})
export class Media extends Model<Media> {
  static collection(collectionName: string) {
    return chainScope(this, "collection", collectionName) as typeof Media;
  }

  static for(model: LaravelModel) {
    return chainScope(this, "association", model) as typeof Media;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(STRING)
  modelType: string;

  @Column(BIGINT.UNSIGNED)
  modelId: number;

  @Column(STRING)
  collectionName: string;

  @Column(STRING)
  name: string;

  @Column(STRING)
  fileName: string;

  @AllowNull
  @Column(STRING)
  mimeType: string | null;

  @Column(BIGINT.UNSIGNED)
  size: number;

  @AllowNull
  @Column(DOUBLE(11, 8))
  lat: number | null;

  @AllowNull
  @Column(DOUBLE(11, 8))
  lng: number | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  isPublic: boolean;

  @Column({ type: BOOLEAN, defaultValue: false })
  isCover: boolean;

  @AllowNull
  @Column(ENUM("media", "document"))
  fileType: "media" | "document" | null;

  @JsonColumn()
  customProperties: object;

  @JsonColumn()
  generatedConversions: Record<string, boolean>;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  orderColumn: number | null;

  @AllowNull
  @Column(STRING(100))
  photographer: string | null;

  @AllowNull
  @Column(STRING(500))
  description: string | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  /**
   * @deprecated this field is 's3' for all rows in the DB and may be safely ignored
   */
  @Column(STRING)
  disk: string;

  /**
   * @deprecated this field is 's3' for all rows in the DB and may be safely ignored
   */
  @AllowNull
  @Column(STRING)
  conversionsDisk: string | null;

  /**
   * @deprecated this field is unused in our database. All rows contain "[]"
   */
  @JsonColumn()
  manipulations: string[];

  /**
   * @deprecated this field is unused in our database. All rows contain "[]"
   */
  @JsonColumn()
  responsiveImages: string[];

  /**
   * @deprecated this field is empty for all rows in the DB and may be safely ignored
   */
  @AllowNull
  @Column(STRING)
  tag: string | null;
}
