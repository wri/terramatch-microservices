import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";
import { Project } from "./project.entity";
import { Literal } from "sequelize/types/utils";
import { isNumber } from "lodash";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  targetable: (laravelType: string, ids: number[] | Literal) => ({
    where: {
      targetableType: laravelType,
      targetableId: ids
    }
  })
}))
@Table({
  tableName: "v2_actions",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names
  indexes: [{ name: "v2_actions_targetable_type_targetable_id_index", fields: ["targetable_type", "targetable_id"] }]
})
export class Action extends Model<Action> {
  static targetable(laravelType: string, ids: number | number[] | Literal) {
    if (isNumber(ids)) ids = [ids];
    return chainScope(this, "targetable", laravelType, ids) as typeof Action;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @Column(STRING)
  targetableType: string;

  @Column(BIGINT.UNSIGNED)
  targetableId: number;

  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number;

  @BelongsTo(() => Organisation)
  organisation?: Organisation;

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number | null;

  @BelongsTo(() => Project)
  project?: Project;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(STRING)
  subtype: string | null;

  @AllowNull
  @Column(STRING)
  key: string | null;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(STRING)
  subTitle: string | null;

  @AllowNull
  @Column(STRING)
  text: string | null;
}
