import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { FormModel } from "../constants/entities";
import { laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  entity: (entity: FormModel) => ({
    where: {
      invasiveableType: laravelType(entity),
      invasiveableId: entity.id
    }
  })
}))
@Table({ tableName: "v2_invasives", underscored: true, paranoid: true })
export class Invasive extends Model<InferAttributes<Invasive>, InferCreationAttributes<Invasive>> {
  static readonly LARAVEL_TYPE = "App\\Models\\Invasive";
  static readonly POLYMORPHIC_TYPE = "invasiveableType";
  static readonly POLYMORPHIC_ID = "invasiveableId";

  static for(entity: FormModel) {
    return chainScope(this, "entity", entity) as typeof Invasive;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @Column(STRING)
  invasiveableType: string;

  @Column(BIGINT.UNSIGNED)
  invasiveableId: number;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: CreationOptional<boolean>;
}
