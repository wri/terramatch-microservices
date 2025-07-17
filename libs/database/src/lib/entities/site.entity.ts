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
import { BIGINT, BOOLEAN, DATE, DECIMAL, INTEGER, Op, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";
import { SitePolygon } from "./site-polygon.entity";
import {
  APPROVED,
  RESTORATION_IN_PROGRESS,
  SiteStatus,
  SiteStatusStates,
  STARTED,
  UpdateRequestStatus
} from "../constants/status";
import { SitingStrategy } from "../constants/entity-selects";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";
import { Framework } from "./framework.entity";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { PlantingStatus, PLANTING_STATUSES } from "../constants/planting-status";

@Scopes(() => ({
  approved: { where: { status: { [Op.in]: Site.APPROVED_STATUSES } } },
  nonDraft: { where: { status: { [Op.ne]: STARTED } } },
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model<Site> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly APPROVED_STATUSES = [APPROVED, RESTORATION_IN_PROGRESS] as SiteStatus[];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\Site";

  static readonly MEDIA = {
    media: { dbCollection: "media", multiple: true, validation: "general-documents" },
    socioeconomicBenefits: { dbCollection: "socioeconomic_benefits", multiple: true, validation: "general-documents" },
    file: { dbCollection: "file", multiple: true, validation: "general-documents" },
    otherAdditionalDocuments: {
      dbCollection: "other_additional_documents",
      multiple: true,
      validation: "general-documents"
    },
    photos: { dbCollection: "photos", multiple: true, validation: "photos" },
    treeSpecies: { dbCollection: "tree_species", multiple: true, validation: "general-documents" },
    documentFiles: { dbCollection: "document_files", multiple: true, validation: "general-documents" },
    stratificationForHeterogeneity: {
      dbCollection: "stratification_for_heterogeneity",
      multiple: false,
      validation: "general-documents"
    }
  } as const;

  static approved() {
    return chainScope(this, "approved") as typeof Site;
  }

  static nonDraft() {
    return chainScope(this, "nonDraft") as typeof Site;
  }

  static project(id: number) {
    return chainScope(this, "project", id) as typeof Site;
  }

  static approvedIdsSubquery(projectId: number) {
    return Subquery.select(Site, "id").eq("projectId", projectId).in("status", Site.APPROVED_STATUSES).literal;
  }

  static approvedIdsProjectsSubquery(projectIds: number[]) {
    return Subquery.select(Site, "id").in("projectId", projectIds).in("status", Site.APPROVED_STATUSES).literal;
  }

  static approvedUuidsSubquery(projectId: number) {
    return Subquery.select(Site, "uuid").eq("projectId", projectId).in("status", Site.APPROVED_STATUSES).literal;
  }

  static approvedUuidsProjectsSubquery(projectIds: number[]) {
    return Subquery.select(Site, "uuid").in("projectId", projectIds).in("status", Site.APPROVED_STATUSES).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  name: string;

  @StateMachineColumn(SiteStatusStates)
  status: SiteStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  framework: Framework | null;

  get frameworkUuid() {
    return this.framework?.uuid;
  }

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @BelongsTo(() => Project)
  project: Project | null;

  get projectName() {
    return this.project?.name;
  }

  get projectUuid() {
    return this.project?.uuid;
  }

  get projectCountry() {
    return this.project?.country;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  @AllowNull
  @Column(STRING)
  sitingStrategy: SitingStrategy | null;

  @AllowNull
  @Column(TEXT)
  descriptionSitingStrategy: string | null;

  @AllowNull
  @Column(DECIMAL(15, 1))
  hectaresToRestoreGoal: number | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(BOOLEAN)
  controlSite: boolean | null;

  @AllowNull
  @Column(TEXT)
  history: string | null;

  @AllowNull
  @Column(DATE)
  startDate: Date | null;

  @AllowNull
  @Column(DATE)
  endDate: Date | null;

  @AllowNull
  @JsonColumn()
  landTenures: string[] | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  survivalRatePlanted: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  directSeedingSurvivalRate: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  aNatRegenerationTreesPerHectare: number | null;

  @AllowNull
  @Column(INTEGER)
  aNatRegeneration: number | null;

  @AllowNull
  @Column(TEXT)
  landscapeCommunityContribution: string | null;

  @AllowNull
  @Column(TEXT)
  technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  plantingPattern: string | null;

  @AllowNull
  @Column(STRING)
  soilCondition: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  aimYearFiveCrownCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  aimNumberOfMatureTrees: number | null;

  @AllowNull
  @JsonColumn()
  landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  restorationStrategy: string[] | null;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(TEXT("long"))
  answers: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ppcExternalId: number | null;

  @AllowNull
  @JsonColumn()
  detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column({ type: STRING, values: PLANTING_STATUSES })
  plantingStatus: PlantingStatus | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Site.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted ?? [];
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Site.LARAVEL_TYPE, collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedable_type: Site.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;

  @HasMany(() => SiteReport)
  reports: SiteReport[] | null;

  async loadReports() {
    this.reports ??= await this.$get("reports");
    return this.reports ?? [];
  }

  @HasMany(() => SitePolygon, { foreignKey: "siteUuid", sourceKey: "uuid" })
  sitePolygons: SitePolygon[] | null;
}
