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
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @StateMachineColumn(DelayedJobStatusStates)
  declare status: CreationOptional<DelayedJobStatus>;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  declare statusCode: number | null;

  @AllowNull
  @JsonColumn()
  declare payload: object | null;

  @AllowNull
  @Column(INTEGER)
  declare totalContent: number | null;

  @AllowNull
  @Column(INTEGER)
  declare processedContent: number | null;

  @AllowNull
  @Column(STRING)
  declare progressMessage: string | null;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  // Defaults to true because by default we don't want delayed jobs to show up on the bulk delayed
  // jobs popup in the FE. That is an opt-in behavior.
  @Column({ type: BOOLEAN, defaultValue: true })
  declare isAcknowledged: CreationOptional<boolean>;

  @AllowNull
  @Column(STRING)
  declare name: string | null;

  @AllowNull
  @JsonColumn()
  declare metadata: Metadata | null;
}
