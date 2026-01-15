import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Project } from "./project.entity";
import { User } from "./user.entity";
import { BIGINT, BOOLEAN, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";
import { Subquery } from "../util/subquery.builder";

@Table({ tableName: "v2_project_users", underscored: true })
export class ProjectUser extends Model<InferAttributes<ProjectUser>, InferCreationAttributes<ProjectUser>> {
  static userProjectsSubquery(userId: number) {
    return Subquery.select(ProjectUser, "projectId").eq("userId", userId).literal;
  }

  static projectsManageSubquery(userId: number) {
    return Subquery.select(ProjectUser, "projectId").eq("userId", userId).eq("isManaging", true).literal;
  }

  static projectUsersSubquery(projectId: number) {
    return Subquery.select(ProjectUser, "userId").eq("projectId", projectId).literal;
  }

  static projectManagersSubquery(projectId: number) {
    return Subquery.select(ProjectUser, "userId").eq("projectId", projectId).eq("isManaging", true).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  userId: number;

  @AllowNull
  @Column(STRING)
  status: string | null;

  // Note: this is marked as nullable in the current schema, but has a default value. The
  // nullability should be removed when v3 is responsible for the DB schema.
  @Column({ type: BOOLEAN, defaultValue: false })
  isMonitoring: CreationOptional<boolean>;

  // Note: this is marked as nullable in the current schema, but has a default value. The
  // nullability should be removed when v3 is responsible for the DB schema.
  @Column({ type: BOOLEAN, defaultValue: false })
  isManaging: CreationOptional<boolean>;
}
