import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { FormModel } from "../constants/entities";
import { laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

export const STAKEHOLDER_KEY_ROLES = [
  "authorities",
  "negatively-affected-people",
  "owners",
  "resource-users",
  "stewards"
] as const;
export type StakeholderKeyRole = (typeof STAKEHOLDER_KEY_ROLES)[number];

@Scopes(() => ({
  entity: (entity: FormModel) => ({
    where: {
      stakeholderableType: laravelType(entity),
      stakeholderableId: entity.id
    }
  })
}))
@Table({ tableName: "stakeholders", underscored: true, paranoid: true })
export class Stakeholder extends Model<InferAttributes<Stakeholder>, InferCreationAttributes<Stakeholder>> {
  static readonly POLYMORPHIC_TYPE = "stakeholderableType";
  static readonly POLYMORPHIC_ID = "stakeholderableId";

  static for(entity: FormModel) {
    return chainScope(this, "entity", entity) as typeof Stakeholder;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @Column(STRING)
  declare stakeholderableType: string;

  @Column(BIGINT.UNSIGNED)
  declare stakeholderableId: number;

  @AllowNull
  @Column(STRING)
  declare name: string | null;

  @AllowNull
  @Column(STRING)
  declare keyRole: StakeholderKeyRole | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;
}
