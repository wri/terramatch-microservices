import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { FormModel } from "../constants/entities";
import { laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  entity: (entity: FormModel) => ({
    where: {
      stratasableType: laravelType(entity),
      stratasableId: entity.id
    }
  })
}))
@Table({ tableName: "v2_stratas", underscored: true, paranoid: true })
export class Strata extends Model<InferAttributes<Strata>, InferCreationAttributes<Strata>> {
  static readonly POLYMORPHIC_TYPE = "stratasableType";
  static readonly POLYMORPHIC_ID = "stratasableId";

  static for(entity: FormModel) {
    return chainScope(this, "entity", entity) as typeof Strata;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ownerId: number | null;

  @Column(STRING)
  declare stratasableType: string;

  @Column(BIGINT.UNSIGNED)
  declare stratasableId: number;

  @AllowNull
  @Column(STRING)
  declare description: string | null;

  @AllowNull
  @Column(INTEGER)
  declare extent: number | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare hidden: boolean;
}
