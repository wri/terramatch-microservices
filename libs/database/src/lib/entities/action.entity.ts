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
import { chainScope } from "../util/chain-scope";
import { LaravelModel, laravelType } from "../types/util";

@Scopes(() => ({
  targetable: (targetable: LaravelModel) => ({
    where: {
      targetableType: laravelType(targetable),
      targetableId: targetable.id
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
  static for(targetable: LaravelModel) {
    return chainScope(this, "targetable", targetable) as typeof Action;
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

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number | null;

  @BelongsTo(() => Organisation)
  organisation?: Organisation | null;

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
