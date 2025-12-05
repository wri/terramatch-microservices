import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DATE,
  ENUM,
  InferAttributes,
  InferCreationAttributes,
  NOW,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { LaravelModel, laravelType, StatusModel } from "../types/util";
import { MediaConfiguration } from "../constants/media-owners";
import { chainScope } from "../util/chain-scope";
import { Project } from "./project.entity";
import { Site } from "./site.entity";
import { Nursery } from "./nursery.entity";
import { ProjectReport } from "./project-report.entity";
import { SiteReport } from "./site-report.entity";
import { NurseryReport } from "./nursery-report.entity";
import { SitePolygon } from "./site-polygon.entity";
import { DisturbanceReport } from "./disturbance-report.entity";
import { User } from "./user.entity";

const TYPES = ["change-request", "status", "submission", "comment", "change-request-updated", "reminder-sent"] as const;
type AuditStatusType = (typeof TYPES)[number];

type AuditStatusMedia = "attachments";

@Scopes(() => ({
  auditable: (auditable: LaravelModel) => ({
    where: {
      auditableType: laravelType(auditable),
      auditableId: auditable.id
    }
  })
}))
@Table({
  tableName: "audit_statuses",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names in all contexts
  indexes: [{ name: "audit_statuses_auditable_type_auditable_id_index", fields: ["auditable_type", "auditable_id"] }]
})
export class AuditStatus extends Model<InferAttributes<AuditStatus>, InferCreationAttributes<AuditStatus>> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\AuditStatus\\AuditStatus";
  static readonly MEDIA: Record<AuditStatusMedia, MediaConfiguration> = {
    attachments: { dbCollection: "attachments", multiple: true, validation: "general-documents" }
  };

  static readonly AUDITABLE_LARAVEL_TYPES = [
    Project.LARAVEL_TYPE,
    Site.LARAVEL_TYPE,
    Nursery.LARAVEL_TYPE,
    ProjectReport.LARAVEL_TYPE,
    SiteReport.LARAVEL_TYPE,
    NurseryReport.LARAVEL_TYPE,
    SitePolygon.LARAVEL_TYPE,
    DisturbanceReport.LARAVEL_TYPE
  ];

  static for(auditable: LaravelModel) {
    return chainScope(this, "auditable", auditable) as typeof AuditStatus;
  }

  static async createAudit(
    model: LaravelModel & StatusModel,
    createdBy?: number | null,
    type?: AuditStatusType | null,
    comment?: string | null
  ) {
    const auditableType = laravelType(model);
    if (!AuditStatus.AUDITABLE_LARAVEL_TYPES.includes(auditableType)) {
      return;
    }

    const user =
      createdBy == null
        ? undefined
        : await User.findOne({
            where: { id: createdBy },
            attributes: ["emailAddress", "firstName", "lastName"]
          });
    await AuditStatus.create({
      auditableType,
      auditableId: model.id,
      status: model.status,
      createdBy: user?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName,
      type,
      comment
    });
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @AllowNull
  @Column(TEXT)
  comment: string | null;

  @AllowNull
  @Column(STRING)
  firstName: string | null;

  @AllowNull
  @Column(STRING)
  lastName: string | null;

  @AllowNull
  @Column({ type: ENUM, values: TYPES })
  type: AuditStatusType | null;

  /**
   * @deprecated
   *
   * All records in the DB have null for this field, so it seems not to be useful.
   */
  @AllowNull
  @Column(BOOLEAN)
  isSubmitted: boolean | null;

  /**
   * @deprecated
   *
   * All records in the DB have true for this field, so it seems not to be useful.
   */
  @AllowNull
  @Column({ type: BOOLEAN, defaultValue: true })
  isActive: boolean | null;

  /**
   * @deprecated
   *
   * All records in the DB have null for this field, so it seems not to be useful.
   */
  @AllowNull
  @Column(BOOLEAN)
  requestRemoved: boolean | null;

  /**
   * @deprecated
   *
   * Needs an investigation to see if this field is being used anywhere, but it is totally superfluous with the
   * automatic createdAt field.
   **/
  @AllowNull
  @Column({ type: DATE, defaultValue: NOW })
  dateCreated: Date | null;

  @AllowNull
  @Column(STRING)
  createdBy: string | null;

  @Column(STRING)
  auditableType: string;

  @Column(BIGINT.UNSIGNED)
  auditableId: number;
}
