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
  BOOLEAN,
  CreationOptional,
  DATE,
  DECIMAL,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  Op,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";
import { SitePolygon } from "./site-polygon.entity";
import {
  APPROVED,
  EntityStatus,
  EntityStatusStates,
  STARTED,
  statusUpdateSequelizeHook,
  UpdateRequestStatus
} from "../constants/status";
import { SitingStrategy } from "../constants/entity-selects";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants";
import { Framework } from "./framework.entity";
import { chainScope } from "../util/chain-scope";
import { Subquery } from "../util/subquery.builder";
import { JsonColumn } from "../decorators/json-column.decorator";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { MediaConfiguration } from "../constants/media-owners";
import { Dictionary, isNumber } from "lodash";
import { removeMedia } from "../hooks/remove-media";
import { removeActions } from "../hooks/remove-actions";
import { Literal } from "sequelize/types/utils";

type SiteMedia =
  | "media"
  | "socioeconomicBenefits"
  | "file"
  | "otherAdditionalDocuments"
  | "photos"
  | "treeSpecies"
  | "documentFiles"
  | "stratificationForHeterogeneity";

@Scopes(() => ({
  approved: { where: { status: { [Op.in]: Site.APPROVED_STATUSES } } },
  nonDraft: { where: { status: { [Op.ne]: STARTED } } },
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({
  tableName: "v2_sites",
  underscored: true,
  paranoid: true,
  hooks: {
    afterCreate: statusUpdateSequelizeHook,
    afterDestroy: async (site: Site) => {
      await removeMedia(site);
      await removeActions(site);
      const reports = await SiteReport.findAll({ where: { siteId: site.id }, attributes: ["id"] });
      await Promise.all(reports.map(report => report.destroy()));
    }
  }
})
export class Site extends Model<InferAttributes<Site>, InferCreationAttributes<Site>> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees", "invasiveTrees"];
  static readonly APPROVED_STATUSES = [APPROVED] as EntityStatus[];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\Site";

  static readonly MEDIA: Record<SiteMedia, MediaConfiguration> = {
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
  };

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

  static uuidsSubquery(projectIds: number | number[] | Literal) {
    if (isNumber(projectIds)) projectIds = [projectIds];
    return Subquery.select(Site, "uuid").in("projectId", projectIds).literal;
  }

  static idsSubquery(projectId: number) {
    return Subquery.select(Site, "id").eq("projectId", projectId).literal;
  }

  static idsForUuidsSubquery(siteUuids: string[] | Literal) {
    return Subquery.select(Site, "id").in("uuid", siteUuids).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  get exportId(): CreationOptional<number> {
    return this.ppcExternalId ?? this.id;
  }

  @AllowNull
  @Column(STRING)
  declare name: string | null;

  @StateMachineColumn(EntityStatusStates)
  declare status: CreationOptional<EntityStatus>;

  @AllowNull
  @Column(STRING)
  declare updateRequestStatus: UpdateRequestStatus | null;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  linkToTerramatch(frontendUrl: string) {
    return `${frontendUrl}/admin#/site/${this.uuid}/show`;
  }

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  get frameworkUuid(): string | undefined {
    return this.framework?.uuid;
  }

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number;

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

  get projectCountry() {
    return this.project?.country;
  }

  get organisationUuid() {
    return this.project?.organisationUuid;
  }

  get organisationName() {
    return this.project?.organisationName;
  }

  get organisationReadableType() {
    return this.project?.organisationReadableType;
  }

  @AllowNull
  @Column(STRING)
  declare sitingStrategy: SitingStrategy | null;

  @AllowNull
  @Column(TEXT)
  declare descriptionSitingStrategy: string | null;

  @AllowNull
  @Column(DECIMAL(15, 1))
  declare hectaresToRestoreGoal: number | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @Column(BOOLEAN)
  declare controlSite: boolean | null;

  @AllowNull
  @Column(TEXT)
  declare history: string | null;

  @AllowNull
  @Column(DATE)
  declare startDate: Date | null;

  @AllowNull
  @Column(DATE)
  declare endDate: Date | null;

  @AllowNull
  @JsonColumn()
  declare landTenures: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare landTenureApproach: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare survivalRatePlanted: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare directSeedingSurvivalRate: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare aNatRegenerationTreesPerHectare: number | null;

  @AllowNull
  @Column(INTEGER)
  declare aNatRegeneration: number | null;

  @AllowNull
  @Column(TEXT)
  declare landscapeCommunityContribution: string | null;

  @AllowNull
  @Column(TEXT)
  declare technicalNarrative: string | null;

  @AllowNull
  @Column(TEXT)
  declare plantingPattern: string | null;

  @AllowNull
  @Column(STRING)
  declare soilCondition: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare aimYearFiveCrownCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare aimNumberOfMatureTrees: number | null;

  @AllowNull
  @JsonColumn()
  declare landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  declare restorationStrategy: string[] | null;

  @AllowNull
  @JsonColumn()
  declare anrPractices: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare feedback: string | null;

  @AllowNull
  @JsonColumn()
  declare feedbackFields: string[] | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  declare answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ppcExternalId: number | null;

  @AllowNull
  @JsonColumn()
  declare detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column(TEXT("long"))
  declare boundaryGeojson: string | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Site.LARAVEL_TYPE, collection: "tree-planted" }
  })
  declare treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted ?? [];
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Site.LARAVEL_TYPE, collection: "non-tree" }
  })
  declare nonTrees: TreeSpecies[] | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Site.LARAVEL_TYPE, collection: "invasive" }
  })
  declare invasiveTrees: TreeSpecies[] | null;

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedable_type: Site.LARAVEL_TYPE }
  })
  declare seedsPlanted: Seeding[] | null;

  @HasMany(() => SiteReport)
  declare reports: SiteReport[] | null;

  async loadReports() {
    this.reports ??= await this.$get("reports");
    return this.reports ?? [];
  }

  @HasMany(() => SitePolygon, { foreignKey: "siteUuid", sourceKey: "uuid" })
  declare sitePolygons: SitePolygon[] | null;
}
