import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, INTEGER, JSON, STRING, UUID } from "sequelize";
import { User } from "./user.entity";
import { Site } from "./site.entity";
import { Project } from "./project.entity";

interface EntityAssociations {
  getEntityProject(): Promise<Project | null>;
  getEntitySite(): Promise<Site | null>;
}

@Table({ tableName: "delayed_jobs", underscored: true })
export class DelayedJob extends Model<DelayedJob> implements EntityAssociations {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Default("pending")
  @Column(STRING)
  status: string;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  statusCode: number | null;

  @AllowNull
  @Column(JSON)
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

  @Column(BOOLEAN)
  isAcknowledged: boolean;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @Column(STRING)
  entityType: string | null;

  @ForeignKey(() => Project)
  @ForeignKey(() => Site)
  @Column
  entityId: number;

  @BelongsTo(() => Project, {
    foreignKey: "entityId",
    constraints: false,
    scope: {
      entityType: "App\\Models\\V2\\Projects\\Project"
    },
    as: "entityProject"
  })
  entityProject?: Project;

  @BelongsTo(() => Site, {
    foreignKey: "entityId",
    constraints: false,
    scope: {
      entityType: "App\\Models\\V2\\Sites\\Site"
    },
    as: "entitySite"
  })
  entitySite?: Site;

  declare getEntityProject: () => Promise<Project | null>;
  declare getEntitySite: () => Promise<Site | null>;

  async getRelatedEntity(): Promise<string | null> {
    if (!this.entityId) return null;

    if (this.entityType === "App\\Models\\V2\\Projects\\Project") {
      const project = this.entityProject ?? (await this.getEntityProject());
      return project?.name ?? null;
    }

    if (this.entityType === "App\\Models\\V2\\Sites\\Site") {
      const site = this.entitySite ?? (await this.getEntitySite());
      return site?.name ?? null;
    }

    return null;
  }
}
