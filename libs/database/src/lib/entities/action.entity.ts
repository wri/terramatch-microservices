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
import { BIGINT, STRING, UUID, UUIDV4, Op } from "sequelize";
import { Organisation } from "./organisation.entity";
import { Project } from "./project.entity";
import { Subquery } from "../util/subquery.builder";
import { chainScope } from "../util/chain-scope";
import { LaravelModel, LaravelModelCtor, laravelType } from "../types/util";

@Scopes(() => ({
  targetable: (targetable: LaravelModel) => ({
    where: {
      targetableType: laravelType(targetable),
      targetableId: targetable.id
    }
  }),
  withTargetableStatus: (targets: LaravelModelCtor[], statuses: string[]) => {
    const buildCondition = (ModelClass: LaravelModelCtor) => ({
      targetableType: laravelType(ModelClass),
      targetableId: {
        [Op.in]: Subquery.select(ModelClass, "id").in("status", statuses).literal
      }
    });

    return {
      where: {
        [Op.or]: targets.map(ModelClass => buildCondition(ModelClass))
      }
    };
  }
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

  static withTargetableStatus(targets: LaravelModelCtor[], statuses: string[]) {
    return chainScope(this, "withTargetableStatus", targets, statuses) as typeof Action;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @AllowNull
  @Column(STRING)
  declare status: string | null;

  @Column(STRING)
  declare targetableType: string;

  @Column(BIGINT.UNSIGNED)
  declare targetableId: number;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number | null;

  @BelongsTo(() => Organisation)
  declare organisation?: Organisation | null;

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number | null;

  @BelongsTo(() => Project)
  declare project?: Project;

  @AllowNull
  @Column(STRING)
  declare type: string | null;

  @AllowNull
  @Column(STRING)
  declare subtype: string | null;

  @AllowNull
  @Column(STRING)
  declare key: string | null;

  @AllowNull
  @Column(STRING)
  declare title: string | null;

  @AllowNull
  @Column(STRING)
  declare subTitle: string | null;

  @AllowNull
  @Column(STRING)
  declare text: string | null;
}
