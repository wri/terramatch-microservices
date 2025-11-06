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
import { BIGINT, DATE, INTEGER, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
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
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class Nursery extends Model<Nursery> {
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

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @StateMachineColumn(EntityStatusStates)
  status: EntityStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @AllowNull
  @Column(DATE)
  startDate: Date | null;

  @AllowNull
  @Column(DATE)
  endDate: Date | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  seedlingGrown: number | null;

  @AllowNull
  @Column(TEXT)
  plantingContribution: string | null;

  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  answers: object | null;

  @BelongsTo(() => Project)
  project: Project | null;

  get projectName() {
    return this.project?.name;
  }

  get projectUuid() {
    return this.project?.uuid;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Nursery.LARAVEL_TYPE, collection: "nursery-seedling" }
  })
  seedlings: TreeSpecies[] | null;

  @HasMany(() => NurseryReport)
  reports: NurseryReport[] | null;
}
