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
import { BIGINT, STRING, TEXT, UUID } from "sequelize";
import { Organisation } from "./organisation.entity";
import { Project } from "./project.entity";
import { User } from "./user.entity";
import { FrameworkKey } from "../constants/framework";
import { JsonColumn } from "../decorators/json-column.decorator";
import { EntityClass, EntityModel } from "../constants/entities";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  entity: <T extends EntityModel>(entity: T) => ({
    where: {
      updateRequestableType: (entity.constructor as EntityClass<T>).LARAVEL_TYPE,
      updateRequestableId: entity.id
    }
  })
}))
@Table({ tableName: "v2_update_requests", underscored: true, paranoid: true })
export class UpdateRequest extends Model<UpdateRequest> {
  static for<T extends EntityModel>(entity: T) {
    return chainScope(this, "entity", entity) as typeof UpdateRequest;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
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

  @AllowNull
  @Column(STRING)
  status: string;

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
