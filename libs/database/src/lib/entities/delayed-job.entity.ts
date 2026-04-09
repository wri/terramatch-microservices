import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
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
import { User } from "./user.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { DelayedJobStatus, DelayedJobStatusStates } from "../constants/status";

// holds the definition for members that may exist in a job metadata that this codebase explicitly
// references.
interface Metadata {
  entity_name?: string;
  entity_type?: string;
  entity_id?: number;
}
@Table({ tableName: "delayed_jobs", underscored: true })
export class DelayedJob extends Model<InferAttributes<DelayedJob>, InferCreationAttributes<DelayedJob>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @StateMachineColumn(DelayedJobStatusStates)
  status: CreationOptional<DelayedJobStatus>;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  statusCode: number | null;

  @AllowNull
  @JsonColumn()
  payload: object | null;

  @AllowNull
  @Column(INTEGER)
  totalContent: number | null;

  @AllowNull
  @Column(INTEGER)
  processedContent: number | null;

  @AllowNull
  @Column(STRING)
  progressMessage: string | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  isAcknowledged: CreationOptional<boolean>;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @JsonColumn()
  metadata: Metadata | null;
}
