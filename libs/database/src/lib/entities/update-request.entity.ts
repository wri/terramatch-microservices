import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Organisation } from "./organisation.entity";
import { Project } from "./project.entity";
import { User } from "./user.entity";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { EntityModel } from "../constants/entities";
import { chainScope } from "../util/chain-scope";
import { laravelType } from "../types/util";
import { UpdateRequestStatus, UpdateRequestStatusStates } from "../constants/status";
import { StateMachineColumn } from "../util/model-column-state-machine";

@Scopes(() => ({
  entity: (entity: EntityModel) => ({
    where: {
      updateRequestableType: laravelType(entity),
      updateRequestableId: entity.id
    }
  }),
  current: () => ({
    where: { status: { [Op.ne]: "approved" } },
    order: [["createdAt", "DESC"]]
  })
}))
@Table({ tableName: "v2_update_requests", underscored: true, paranoid: true })
export class UpdateRequest extends Model<UpdateRequest> {
  static for(entity: EntityModel) {
    return chainScope(this, "entity", entity) as typeof UpdateRequest;
  }

  static current() {
    return chainScope(this, "current") as typeof UpdateRequest;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number | null;

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdById: number | null;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @StateMachineColumn(UpdateRequestStatusStates)
  status: UpdateRequestStatus;

  @AllowNull
  @JsonColumn()
  content: object | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @Column({ type: STRING, field: "updaterequestable_type" })
  updateRequestableType: string;

  @Column({ type: BIGINT.UNSIGNED, field: "updaterequestable_id" })
  updateRequestableId: number;
}
