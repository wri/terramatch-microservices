import {
  AllowNull,
  AutoIncrement,
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
import { Logger } from "@nestjs/common";

const ENTITY_TYPE_MAPPING: Record<string, any> = {
  "App\\Models\\V2\\Sites\\Site": Site,
  "App\\Models\\V2\\Projects\\Project": Project
};
@Table({ tableName: "delayed_jobs", underscored: true })
export class DelayedJob extends Model<DelayedJob> {
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

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  entityId: number | null;

  /**
   * Fetch the related entity dynamically based on the entityType and entityId.
   */
  async getRelatedEntity() {
    const Model = ENTITY_TYPE_MAPPING[this.entityType || ""];
    if (Model && this.entityId) {
      const entity = await Model.findByPk(this.entityId);
      return entity?.name;
    }

    return null;
  }
}
