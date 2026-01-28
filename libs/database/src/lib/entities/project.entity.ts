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
  Table
} from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  DATE,
  DECIMAL,
  ENUM,
  InferAttributes,
  InferCreationAttributes,
  INTEGER,
  STRING,
  TEXT,
  TINYINT,
  UUID,
  UUIDV4
} from "sequelize";
import { Organisation } from "./organisation.entity";
import { TreeSpecies } from "./tree-species.entity";
import { ProjectReport } from "./project-report.entity";
import { Application } from "./application.entity";
import { Site } from "./site.entity";
import { Nursery } from "./nursery.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { FrameworkKey } from "../constants";
import { Framework } from "./framework.entity";
import { EntityStatus, EntityStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { Subquery } from "../util/subquery.builder";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { MediaConfiguration } from "../constants/media-owners";
import { InternalServerErrorException } from "@nestjs/common";
import { Dictionary } from "lodash";

type ProjectMedia =
  | "media"
  | "socioeconomicBenefits"
  | "file"
  | "otherAdditionalDocuments"
  | "photos"
  | "documentFiles"
  | "programmeSubmission"
  | "detailedProjectBudget"
  | "proofOfLandTenureMou";

@Table({
  tableName: "v2_projects",
  underscored: true,
  paranoid: true,
  hooks: { afterCreate: statusUpdateSequelizeHook }
})
export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted"];
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Projects\\Project";

  static readonly MEDIA: Record<ProjectMedia, MediaConfiguration> = {
    media: { dbCollection: "media", multiple: true, validation: "general-documents" },
    socioeconomicBenefits: { dbCollection: "socioeconomic_benefits", multiple: true, validation: "general-documents" },
    file: { dbCollection: "file", multiple: true, validation: "general-documents" },
    otherAdditionalDocuments: {
      dbCollection: "other_additional_documents",
      multiple: true,
      validation: "general-documents"
    },
    photos: { dbCollection: "photos", multiple: true, validation: "photos" },
    documentFiles: { dbCollection: "document_files", multiple: true, validation: "general-documents" },
    programmeSubmission: { dbCollection: "programme_submission", multiple: true, validation: "general-documents" },
    detailedProjectBudget: {
      dbCollection: "detailed_project_budget",
      multiple: false,
      validation: "general-documents"
    },
    proofOfLandTenureMou: { dbCollection: "proof_of_land_tenure_mou", multiple: true, validation: "general-documents" }
  };

  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("Project model is missing sequelize connection");
    }
    return this.sequelize;
  }

  static forOrganisation(organisationId: number) {
    return Subquery.select(Project, "id").eq("organisationId", organisationId).literal;
  }

  static forCohort(cohort: string) {
    return Subquery.select(Project, "id").eq("cohort", cohort).literal;
  }

  static forLandscape(landscapeName: string) {
    return Subquery.select(Project, "id").eq("landscape", landscapeName).literal;
  }

  static forUuid(uuid: string) {
    return Subquery.select(Project, "id").eq("uuid", uuid).literal;
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
  frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  framework: Framework | null;

  get frameworkUuid(): string | undefined {
    return this.framework?.uuid;
  }

  @AllowNull
  @JsonColumn()
  cohort: string[] | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  isTest: CreationOptional<boolean>;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  organisationId: number | null;

  @AllowNull
  @ForeignKey(() => Application)
  @Column(BIGINT.UNSIGNED)
  applicationId: number | null;

  @StateMachineColumn(EntityStatusStates)
  status: CreationOptional<EntityStatus>;

  // Note: this is marked as nullable in the current schema, but has a default value. The
  // nullability should be removed when v3 is responsible for the DB schema.
  @Column({ type: STRING, defaultValue: "no-update" })
  updateRequestStatus: CreationOptional<UpdateRequestStatus>;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @Column(ENUM("new_project", "existing_expansion"))
  projectStatus: string | null;

  @AllowNull
  @Column(TEXT("long"))
  boundaryGeojson: string | null;

  @AllowNull
  @JsonColumn()
  landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  restorationStrategy: string[] | null;

  @AllowNull
  @JsonColumn()
  incomeGeneratingActivities: string[] | null;

  @AllowNull
  @Column(TEXT)
  country: string | null;

  @AllowNull
  @Column(TEXT)
  continent: string | null;

  @AllowNull
  @Column(DATE)
  plantingStartDate: Date | null;

  @AllowNull
  @Column(DATE)
  plantingEndDate: Date | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(TEXT)
  history: string | null;

  @AllowNull
  @Column(TEXT)
  objectives: string | null;

  @AllowNull
  @Column(TEXT)
  environmentalGoals: string | null;

  @AllowNull
  @Column(TEXT)
  socioeconomicGoals: string | null;

  @AllowNull
  @Column(TEXT)
  sdgsImpacted: string | null;

  @AllowNull
  @Column(TEXT)
  longTermGrowth: string | null;

  @AllowNull
  @Column(TEXT)
  communityIncentives: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  budget: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  jobsCreatedGoal: number | null;

  @AllowNull
  @Column(DECIMAL(15, 1))
  totalHectaresRestoredGoal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  treesGrownGoal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  survivalRate: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  yearFiveCrownCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  monitoredTreeCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ppcExternalId: number | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(TEXT)
  organizationName: string | null;

  @AllowNull
  @Column(TEXT)
  projectCountyDistrict: string | null;

  @AllowNull
  @Column(TEXT)
  descriptionOfProjectTimeline: string | null;

  @AllowNull
  @Column(TEXT)
  sitingStrategyDescription: string | null;

  @AllowNull
  @Column(TEXT)
  sitingStrategy: string | null;

  @AllowNull
  @JsonColumn()
  landTenureProjectArea: string[] | null;

  @AllowNull
  @Column(TEXT)
  landholderCommEngage: string | null;

  @AllowNull
  @Column(TEXT)
  projPartnerInfo: string | null;

  @AllowNull
  @Column(TEXT)
  projSuccessRisks: string | null;

  @AllowNull
  @Column(TEXT)
  monitorEvalPlan: string | null;

  @AllowNull
  @Column(TEXT)
  seedlingsSource: string | null;

  @AllowNull
  @Column(TINYINT)
  pctEmployeesMen: number | null;

  @AllowNull
  @Column(TINYINT)
  pctEmployeesWomen: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_18to35" })
  pctEmployees18To35: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_older35" })
  pctEmployeesOlder35: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  projBeneficiaries: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesWomen: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesSmall: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesLarge: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesYouth: number | null;

  @AllowNull
  @JsonColumn()
  detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  projImpactFoodsec: string | null;

  @AllowNull
  @Column(TINYINT)
  pctEmployeesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  pctBeneficiariesMen: number | null;

  @AllowNull
  @Column(TEXT)
  proposedGovPartners: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  proposedNumNurseries: number | null;

  @AllowNull
  @Column(TEXT)
  projBoundary: string | null;

  @AllowNull
  @JsonColumn()
  states: string[] | null;

  @AllowNull
  @Column(TEXT)
  projImpactBiodiv: string | null;

  @AllowNull
  @Column(TEXT)
  waterSource: string | null;

  @AllowNull
  @Column(TEXT)
  baselineBiodiversity: string | null;

  @AllowNull
  @Column(INTEGER)
  goalTreesRestoredPlanting: number | null;

  @AllowNull
  @Column(INTEGER)
  goalTreesRestoredAnr: number | null;

  @AllowNull
  @Column(INTEGER)
  goalTreesRestoredDirectSeeding: number | null;

  @AllowNull
  @Column(DECIMAL(10, 8))
  lat: number | null;

  @AllowNull
  @Column(DECIMAL(11, 8))
  long: number | null;

  @AllowNull
  @Column(STRING)
  landscape: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  directSeedingSurvivalRate: number | null;

  @AllowNull
  @Column(STRING)
  shortName: string | null;

  @AllowNull
  @JsonColumn()
  level1Project: string[] | null;

  @AllowNull
  @JsonColumn()
  level2Project: string[] | null;

  @AllowNull
  @Column(TEXT)
  landTenureApproach: string | null;

  @AllowNull
  @Column(STRING(255))
  seedlingsProcurement: string | null;

  @AllowNull
  @Column(TEXT)
  jobsGoalDescription: string | null;

  @AllowNull
  @Column(TEXT)
  volunteersGoalDescription: string | null;

  @AllowNull
  @Column(TEXT)
  communityEngagementPlan: string | null;

  @AllowNull
  @Column(TEXT)
  directBeneficiariesGoalDescription: string | null;

  @Column({ type: TINYINT, defaultValue: 0 })
  elpProject: CreationOptional<number>;

  @AllowNull
  @Column(TEXT)
  consortium: string | null;

  @AllowNull
  @Column(STRING(255))
  landownerAgreement: string | null;

  @BelongsTo(() => Organisation)
  organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name;
  }

  get organisationUuid() {
    return this.organisation?.uuid;
  }

  get organisationType() {
    return this.organisation?.type;
  }

  @BelongsTo(() => Application)
  application: Application | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Project.LARAVEL_TYPE, collection: "tree-planted" }
  })
  treesPlanted: TreeSpecies[] | null;

  @HasMany(() => ProjectReport)
  reports: ProjectReport[] | null;

  @HasMany(() => Site)
  sites: Site[] | null;

  @HasMany(() => Nursery)
  nurseries: Nursery[] | null;
}
