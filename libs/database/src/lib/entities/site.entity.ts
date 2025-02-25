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
import { BIGINT, BOOLEAN, DATE, INTEGER, literal, Op, STRING, TEXT, UUID } from "sequelize";
import { TreeSpecies } from "./tree-species.entity";
import { SiteReport } from "./site-report.entity";
import { Project } from "./project.entity";
import { SitePolygon } from "./site-polygon.entity";
import { APPROVED, RESTORATION_IN_PROGRESS, SiteStatus, UpdateRequestStatus } from "../constants/status";
import { SitingStrategy } from "../constants/entity-selects";
import { Seeding } from "./seeding.entity";
import { FrameworkKey } from "../constants/framework";
import { Framework } from "./framework.entity";
import { chainScope } from "../util/chain-scope";
import { JsonColumn } from "../decorators/json-column.decorator";

// Incomplete stub
@Scopes(() => ({
  approved: { where: { status: { [Op.in]: Site.APPROVED_STATUSES } } },
  project: (id: number) => ({ where: { projectId: id } })
}))
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model<Site> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
  static readonly APPROVED_STATUSES = [APPROVED, RESTORATION_IN_PROGRESS];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Sites\\Site";

  static readonly MEDIA = {
    // media: { dbCollection: "media", multiple: true },
    // socioeconomicBenefits: { dbCollection: "socioeconomic_benefits", multiple: true },
    // file: { dbCollection: "file", multiple: true },
    // otherAdditionalDocuments: { dbCollection: "other_additional_documents", multiple: true },
    // photos: { dbCollection: "photos", multiple: true },
    // treeSpecies: { dbCollection: "tree_species", multiple: true },
    // documentFiles: { dbCollection: "document_files", multiple: true },
    // stratificationForHeterogeneity: { dbCollection: "stratification_for_heterogeneity", multiple: false }
  } as const;

  static approved() {
    return chainScope(this, "approved") as typeof Site;
  }

  static project(id: number) {
    return chainScope(this, "project", id) as typeof Site;
  }

  static approvedIdsSubquery(projectId: number) {
    const attributes = Site.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Site.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.id.field} FROM ${Site.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.projectId.field} = ${sql.escape(projectId)}
        AND ${attributes.status.field} IN (${Site.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  static approvedUuidsSubquery(projectId: number) {
    const attributes = Site.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Site.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.uuid.field} FROM ${Site.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.projectId.field} = ${sql.escape(projectId)}
        AND ${attributes.status.field} IN (${Site.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  static approvedIdsSiteSubquery(siteId: number) {
    const attributes = Site.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Site.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.id.field} FROM ${Site.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.id.field} = ${sql.escape(siteId)}
        AND ${attributes.status.field} IN (${Site.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  static approvedUuidsSiteSubquery(siteId: number) {
    const attributes = Site.getAttributes();
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const deletedAt = attributes.deletedAt!.field;
    const sql = Site.sequelize!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return literal(
      `(SELECT ${attributes.uuid.field} FROM ${Site.tableName}
        WHERE ${deletedAt} IS NULL
        AND ${attributes.id.field} = ${sql.escape(siteId)}
        AND ${attributes.status.field} IN (${Site.APPROVED_STATUSES.map(s => `"${s}"`).join(",")})
       )`
    );
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  name: string;

  @Column(STRING)
  status: SiteStatus;

  @AllowNull
  @Column(STRING)
  updateRequestStatus: UpdateRequestStatus | null;

  @Index
  @Column(UUID)
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

  @AllowNull
  @Column(STRING)
  sitingStrategy: SitingStrategy | null;

  @AllowNull
  @Column(TEXT)
  descriptionSitingStrategy: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  hectaresToRestoreGoal: number | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(BOOLEAN)
  controlSite: boolean | null;

  @AllowNull
  @Column(STRING)
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
  @Column(INTEGER)
  aNatRegenerationTreesPerHectare: number | null;

  @AllowNull
  @Column(INTEGER)
  aNatRegeneration: number | null;

  @AllowNull
  @Column(STRING)
  landscapeCommunityContribution: string | null;

  @AllowNull
  @Column(STRING)
  technicalNarrative: string | null;

  @AllowNull
  @Column(STRING)
  plantingPattern: string | null;

  // @AllowNull
  // @JsonColumn()
  // soilCondition: string | null;

  @AllowNull
  @Column(INTEGER)
  aimYearFiveCrownCover: number | null;

  @AllowNull
  @Column(INTEGER)
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

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Site.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  async loadTreesPlanted() {
    this.treesPlanted ??= await this.$get("treesPlanted");
    return this.treesPlanted;
  }

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesableType: Site.LARAVEL_TYPE, collection: "non-tree" }
  })
  nonTrees: TreeSpecies[] | null;

  @HasMany(() => Seeding, {
    foreignKey: "seedableId",
    constraints: false,
    scope: { seedableType: Site.LARAVEL_TYPE }
  })
  seedsPlanted: Seeding[] | null;

  @HasMany(() => SiteReport)
  reports: SiteReport[] | null;

  async loadReports() {
    this.reports ??= await this.$get("reports");
    return this.reports;
  }

  @HasMany(() => SitePolygon, { foreignKey: "siteUuid", sourceKey: "uuid" })
  sitePolygons: SitePolygon[] | null;
}
