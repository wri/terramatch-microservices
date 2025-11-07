import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
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
import { LaravelModel, laravelType } from "../types/util";
import { Dictionary } from "factory-girl-ts";

@DefaultScope(() => ({ order: ["orderColumn"] }))
@Scopes(() => ({
  collection: (collectionName: string) => ({ where: { collectionName } }),
  associations: <T extends LaravelModel>(associations: T | T[]) => {
    const models = Array.isArray(associations) ? associations : [associations];
    return {
      where: {
        modelType: laravelType(models[0]),
        modelId: models.map(({ id }) => id)
      }
    };
  }
}))
@Table({
  tableName: "media",
  underscored: true,
  paranoid: true,
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

  /**
   * Note: this only works for an array of a _single model type_. The association scope only
   * checks the first model in the array for the model type.
   */
  static for<T extends LaravelModel>(models: T | T[]) {
    return chainScope(this, "associations", models) as typeof Media;
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
  @Column(ENUM("media", "documents"))
  fileType: "media" | "documents" | null;

  @JsonColumn()
  customProperties: Dictionary<object | string>;

  @JsonColumn()
  generatedConversions: Dictionary<boolean>;

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

  @BelongsTo(() => User, { constraints: false })
  createdByUser: User | null;

  get createdByUserName() {
    const { firstName, lastName } = this.createdByUser ?? {};
    if (firstName != null && lastName != null) {
      return `${firstName} ${lastName}`;
    } else if (firstName != null) {
      return firstName;
    } else if (lastName != null) {
      return lastName;
    } else {
      return null;
    }
  }

  /**
   * @deprecated this field is 's3' for all rows in the DB and may be safely ignored
   */
  @Column({ type: STRING, defaultValue: "s3" })
  disk: string;

  /**
   * @deprecated this field is 's3' for all rows in the DB and may be safely ignored
   */
  @AllowNull
  @Column({ type: STRING, defaultValue: "s3" })
  conversionsDisk: string | null;

  /**
   * @deprecated this field is unused in our database. All rows contain "[]"
   */
  @JsonColumn({ defaultValue: [] })
  manipulations: string[];

  /**
   * @deprecated this field is unused in our database. All rows contain "[]"
   */
  @JsonColumn({ defaultValue: [] })
  responsiveImages: string[];
}
