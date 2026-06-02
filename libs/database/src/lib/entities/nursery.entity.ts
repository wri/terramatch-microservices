import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  DATE,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  Op,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { Project } from "./project.entity";
import { TreeSpecies } from "./tree-species.entity";
import { NurseryReport } from "./nursery-report.entity";
import {
  APPROVED,
  EntityStatus,
  EntityStatusStates,
  STARTED,
  statusUpdateSequelizeHook,
  UpdateRequestStatus
} from "../constants/status";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { FrameworkKey } from "../constants";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { MediaConfiguration } from "../constants/media-owners";
import { Dictionary, isNumber } from "lodash";
import { removeMedia } from "../hooks/remove-media";
import { removeActions } from "../hooks/remove-actions";
import { Literal } from "sequelize/lib/utils";

type NurseryMedia = "media" | "file" | "otherAdditionalDocuments" | "photos";

@Scopes(() => ({
  project: (id: number) => ({ where: { projectId: id } }),
  approved: { where: { status: { [Op.in]: Nursery.APPROVED_STATUSES } } },
  nonDraft: { where: { status: { [Op.ne]: STARTED } } }
}))
@Table({
  tableName: "v2_nurseries",
  underscored: true,
  paranoid: true,
  hooks: {
    afterCreate: statusUpdateSequelizeHook,
    afterDestroy: async (nursery: Nursery) => {
      await removeMedia(nursery);
      await removeActions(nursery);
      const reports = await NurseryReport.findAll({ where: { nurseryId: nursery.id }, attributes: ["id"] });
      await Promise.all(reports.map(report => report.destroy()));
    }
  }
})
export class Nursery extends Model<InferAttributes<Nursery>, InferCreationAttributes<Nursery>> {
  static readonly APPROVED_STATUSES = [APPROVED];
  static readonly TREE_ASSOCIATIONS = ["seedlings"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Nurseries\\Nursery";

  static readonly MEDIA: Record<NurseryMedia, MediaConfiguration> = {
    media: { dbCollection: "media", multiple: true, validation: "general-documents" },
    file: { dbCollection: "file", multiple: true, validation: "general-documents" },
    otherAdditionalDocuments: {
      dbCollection: "other_additional_documents",
      multiple: true,
      validation: "general-documents"
    },
    photos: { dbCollection: "photos", multiple: true, validation: "photos" }
  };

  static approved() {
    return chainScope(this, "approved") as typeof Nursery;
  }

  static nonDraft() {
    return chainScope(this, "nonDraft") as typeof Nursery;
  }

  static project(id: number) {
    return chainScope(this, "project", id) as typeof Nursery;
  }

  static approvedIdsSubquery(projectId: number) {
    return Subquery.select(Nursery, "id").eq("projectId", projectId).in("status", Nursery.APPROVED_STATUSES).literal;
  }

  static idsSubquery(projectId: number) {
    return Subquery.select(Nursery, "id").eq("projectId", projectId).literal;
  }

  static uuidsSubquery(projectIds: number | number[] | Literal) {
    if (isNumber(projectIds)) projectIds = [projectIds];
    return Subquery.select(Nursery, "uuid").in("projectId", projectIds).literal;
  }

  static idsForUuidsSubquery(nurseryUuids: string[] | Literal) {
    return Subquery.select(Nursery, "id").in("uuid", nurseryUuids).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  linkToTerramatch(frontendUrl: string) {
    return `${frontendUrl}/admin#/nursery/${this.uuid}/show`;
  }

  @StateMachineColumn(EntityStatusStates)
  declare status: CreationOptional<EntityStatus>;

  @AllowNull
  @Column(STRING)
  declare updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(STRING)
  declare name: string | null;

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

  @AllowNull
  @Column(DATE)
  declare startDate: Date | null;

  @AllowNull
  @Column(DATE)
  declare endDate: Date | null;

  @AllowNull
  @Column(TEXT)
  declare feedback: string | null;

  @AllowNull
  @JsonColumn()
  declare feedbackFields: string[] | null;

  @AllowNull
  @Column(STRING)
  declare type: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare seedlingGrown: number | null;

  @AllowNull
  @Column(TEXT)
  declare plantingContribution: string | null;

  @AllowNull
  @Column(STRING)
  declare oldModel: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare oldId: number | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  declare answers: Dictionary<unknown> | null;

  @BelongsTo(() => Project)
  declare project: Project | null;

  get projectName() {
    return this.project?.name;
  }

  get projectUuid(): string | undefined {
    return this.project?.uuid;
  }

  get projectExportId(): number | undefined {
    return this.project?.exportId;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  get organisationUuid(): string | undefined {
    return this.project?.organisationUuid;
  }

  get organisationReadableType(): string | undefined {
    return this.project?.organisationReadableType;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Nursery.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  declare seedlings: TreeSpecies[] | null;

  @HasMany(() => NurseryReport)
  declare reports: NurseryReport[] | null;
}
