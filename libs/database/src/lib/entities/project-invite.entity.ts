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
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

  @Column(STRING)
  declare emailAddress: string;

  @AllowNull
  @Column(STRING)
  declare token: string | null;

  @AllowNull
  @Column(DATE)
  declare acceptedAt: Date | null;

  @BelongsTo(() => Project)
  declare project: Project | null;

  @BelongsTo(() => User, { foreignKey: "emailAddress", targetKey: "emailAddress" })
  declare user: User | null;
}
