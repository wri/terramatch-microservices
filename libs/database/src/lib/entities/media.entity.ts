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
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DOUBLE,
  ENUM,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  Op,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { User } from "./user.entity";
import { chainScope } from "../util/chain-scope";
import { LaravelModel, laravelType } from "../types/util";
import { Dictionary } from "factory-girl-ts";
import { InternalServerErrorException } from "@nestjs/common";
import { mediaDestroy } from "../hooks/media-destroy";

@DefaultScope(() => ({ order: ["orderColumn"] }))
@Scopes(() => ({
  collection: (collectionName: string | string[]) => ({
    where: { collectionName: { [Op.in]: Array.isArray(collectionName) ? collectionName : [collectionName] } }
  }),
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
  ],
  hooks: { afterDestroy: mediaDestroy }
})
export class Media extends Model<InferAttributes<Media>, InferCreationAttributes<Media>> {
  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("Project model is missing sequelize connection");
    }
    return this.sequelize;
  }

  static collection(collections: string | string[]) {
    return chainScope(this, "collection", collections) as typeof Media;
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
  declare id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Column(STRING)
  declare modelType: string;

  @Column(BIGINT.UNSIGNED)
  declare modelId: number;

  @Column(STRING)
  declare collectionName: string;

  @Column(STRING)
  declare name: string;

  @Column(STRING)
  declare fileName: string;

  @AllowNull
  @Column(STRING)
  declare mimeType: string | null;

  @Column(BIGINT.UNSIGNED)
  declare size: number;

  @AllowNull
  @Column(DOUBLE(11, 8))
  declare lat: number | null;

  @AllowNull
  @Column(DOUBLE(11, 8))
  declare lng: number | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  declare isPublic: CreationOptional<boolean>;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare isCover: CreationOptional<boolean>;

  @AllowNull
  @Column(ENUM("media", "documents"))
  declare fileType: "media" | "documents" | null;

  @JsonColumn()
  declare customProperties: Dictionary<object | string | number | null>;

  @JsonColumn()
  declare generatedConversions: Dictionary<boolean>;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare orderColumn: number | null;

  @AllowNull
  @Column(STRING(100))
  declare photographer: string | null;

  @AllowNull
  @Column(STRING(500))
  declare description: string | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  @BelongsTo(() => User, { constraints: false })
  declare createdByUser: User | null;

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

  get profileImageScale(): number | null {
    return (this.customProperties?.["profile_image_scale"] as number | null | undefined) ?? null;
  }

  get profileImagePosition(): object | null {
    return (this.customProperties?.["profile_image_position"] as object | null | undefined) ?? null;
  }

  /**
   * @deprecated this field is 's3' for all rows in the DB and may be safely ignored
   */
  @Column({ type: STRING, defaultValue: "s3" })
  declare disk: CreationOptional<string>;

  /**
   * @deprecated this field is 's3' for all rows in the DB and may be safely ignored
   */
  @AllowNull
  @Column({ type: STRING, defaultValue: "s3" })
  declare conversionsDisk: string | null;

  /**
   * @deprecated this field is unused in our database. All rows contain "[]"
   */
  @JsonColumn({ defaultValue: [] })
  declare manipulations: CreationOptional<string[]>;

  /**
   * @deprecated this field is unused in our database. All rows contain "[]"
   */
  @JsonColumn({ defaultValue: [] })
  declare responsiveImages: CreationOptional<string[]>;
}
