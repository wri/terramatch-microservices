import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DATE,
  DECIMAL,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { Subquery } from "../util/subquery.builder";
import { Literal } from "sequelize/types/utils";
import { JsonColumn } from "../decorators/json-column.decorator";
import { FormModel } from "../constants/entities";
import { laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  entity: (entity: FormModel) => ({
    where: {
      disturbanceableType: laravelType(entity),
      disturbanceableId: entity.id
    }
  })
}))
@Table({ tableName: "v2_disturbances", underscored: true, paranoid: true })
export class Disturbance extends Model<InferAttributes<Disturbance>, InferCreationAttributes<Disturbance>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Disturbance";
  static readonly POLYMORPHIC_TYPE = "disturbanceableType";
  static readonly POLYMORPHIC_ID = "disturbanceableId";

  static for(entity: FormModel) {
    return chainScope(this, "entity", entity) as typeof Disturbance;
  }

  static idsSubquery(disturbanceableIds: Literal | number[], disturbanceableType: string) {
    return Subquery.select(Disturbance, "id")
      .eq("disturbanceableType", disturbanceableType)
      .in("disturbanceableId", disturbanceableIds)
      .eq("hidden", false).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @AllowNull
  @Column(STRING)
  declare disturbanceableType: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare disturbanceableId: number | null;

  @AllowNull
  @Column(DATE)
  declare disturbanceDate: Date | null;

  @AllowNull
  @Column(STRING)
  declare collection: string | null;

  @AllowNull
  @Column(STRING)
  declare type: string | null;

  @AllowNull
  @JsonColumn()
  declare subtype: string[] | null;

  @AllowNull
  @Column(STRING)
  declare intensity: string | null;

  @AllowNull
  @Column(STRING)
  declare extent: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare peopleAffected: number | null;

  @AllowNull
  @Column(DECIMAL(15, 2))
  declare monetaryDamage: number | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @Column(TEXT)
  declare actionDescription: string | null;

  @AllowNull
  @JsonColumn()
  declare propertyAffected: string[] | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare oldId: number | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(STRING)
  declare oldModel: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare hidden: CreationOptional<boolean>;
}
