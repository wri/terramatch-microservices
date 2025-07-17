import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, DATE, STRING, UUID, UUIDV4 } from "sequelize";
import { Project } from "./project.entity";
import { User } from "./user.entity";

@Table({ tableName: "v2_project_invites", underscored: true })
export class ProjectInvite extends Model<ProjectInvite> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @Column(STRING)
  emailAddress: string;

  @AllowNull
  @Column(STRING)
  token: string | null;

  @AllowNull
  @Column(DATE)
  acceptedAt: Date | null;

  @BelongsTo(() => Project)
  project: Project | null;

  @BelongsTo(() => User, { foreignKey: "emailAddress", targetKey: "emailAddress" })
  user: User | null;
}
