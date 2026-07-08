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
import { FrameworkKey, POLYGON_DATA_SUBMISSION_DEFAULT } from "../constants";
import { Framework } from "./framework.entity";
import { EntityStatus, EntityStatusStates, statusUpdateSequelizeHook, UpdateRequestStatus } from "../constants/status";
import { Subquery } from "../util/subquery.builder";
import { StateMachineColumn } from "../util/model-column-state-machine";
import { MediaConfiguration } from "../constants/media-owners";
import { InternalServerErrorException } from "@nestjs/common";
import { Dictionary } from "lodash";
import { removeMedia } from "../hooks/remove-media";
import { removeActions } from "../hooks/remove-actions";

import { setPpcExternalId } from "../util/sequelize-hooks";

type ProjectMedia =
  | "media"
  | "socioeconomicBenefits"
  | "file"
  | "otherAdditionalDocuments"
  | "photos"
  | "documentFiles"
  | "programmeSubmission"
  | "detailedProjectBudget"
  | "proofOfLandTenureMou"
  | "consortiumPartnershipAgreements";

@Table({
  tableName: "v2_projects",
  underscored: true,
  paranoid: true,
  hooks: {
    beforeCreate: setPpcExternalId(Project),
    beforeUpdate: setPpcExternalId(Project),
    afterCreate: statusUpdateSequelizeHook,
    afterDestroy: async (project: Project) => {
      await removeMedia(project);
      await removeActions(project);

      // Load these before deleting them individually so that their after destroy hooks fire. This is N+1 behavior,
      // but this happens very rarely and this is cleaner than duplicating all those hooks here.
      const reports = await ProjectReport.findAll({ where: { projectId: project.id }, attributes: ["id"] });
      const sites = await Site.findAll({ where: { projectId: project.id }, attributes: ["id"] });
      const nurseries = await Nursery.findAll({ where: { projectId: project.id }, attributes: ["id"] });
      await Promise.all([...reports, ...sites, ...nurseries].map(entity => entity.destroy()));
    }
  }
})
export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  static readonly TREE_ASSOCIATIONS = ["treesPlanted", "nonTrees"];
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
    proofOfLandTenureMou: { dbCollection: "proof_of_land_tenure_mou", multiple: true, validation: "general-documents" },
    consortiumPartnershipAgreements: {
      dbCollection: "consortium_partnership_agreements",
      multiple: true,
      validation: "general-documents"
    }
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
  declare id: CreationOptional<number>;

  get exportId(): CreationOptional<number> {
    return this.ppcExternalId ?? this.id;
  }

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  linkToTerramatch(frontendUrl: string) {
    return `${frontendUrl}/admin#/project/${this.uuid}/show`;
  }

  @AllowNull
  @Column(STRING)
  declare frameworkKey: FrameworkKey | null;

  @BelongsTo(() => Framework, { foreignKey: "frameworkKey", targetKey: "slug", constraints: false })
  declare framework: Framework | null;

  get frameworkUuid(): string | undefined {
    return this.framework?.uuid;
  }

  @AllowNull
  @Column(STRING(255))
  declare cohort: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare isTest: CreationOptional<boolean>;

  @AllowNull
  @Column(TEXT)
  declare name: string | null;

  @AllowNull
  @ForeignKey(() => Organisation)
  @Column(BIGINT.UNSIGNED)
  declare organisationId: number | null;

  @AllowNull
  @ForeignKey(() => Application)
  @Column(BIGINT.UNSIGNED)
  declare applicationId: number | null;

  @StateMachineColumn(EntityStatusStates)
  declare status: CreationOptional<EntityStatus>;

  // Note: this is marked as nullable in the current schema, but has a default value. The
  // nullability should be removed when v3 is responsible for the DB schema.
  @Column({ type: STRING, defaultValue: "no-update" })
  declare updateRequestStatus: CreationOptional<UpdateRequestStatus>;

  @AllowNull
  @Column(TEXT)
  declare feedback: string | null;

  @AllowNull
  @JsonColumn()
  declare feedbackFields: string[] | null;

  @AllowNull
  @Column(ENUM("new_project", "existing_expansion"))
  declare projectStatus: string | null;

  @AllowNull
  @Column(TEXT("long"))
  declare boundaryGeojson: string | null;

  @AllowNull
  @JsonColumn()
  declare landUseTypes: string[] | null;

  @AllowNull
  @JsonColumn()
  declare restorationStrategy: string[] | null;

  @AllowNull
  @JsonColumn()
  declare incomeGeneratingActivities: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare country: string | null;

  @AllowNull
  @Column(TEXT)
  declare continent: string | null;

  @AllowNull
  @Column(DATE)
  declare plantingStartDate: Date | null;

  @AllowNull
  @Column(DATE)
  declare plantingEndDate: Date | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @Column(TEXT)
  declare history: string | null;

  @AllowNull
  @Column(TEXT)
  declare objectives: string | null;

  @AllowNull
  @Column(TEXT)
  declare projectSummary: string | null;

  @AllowNull
  @Column(TEXT)
  declare environmentalGoals: string | null;

  @AllowNull
  @Column(TEXT)
  declare socioeconomicGoals: string | null;

  @AllowNull
  @Column(TEXT)
  declare sdgsImpacted: string | null;

  @AllowNull
  @Column(TEXT)
  declare longTermGrowth: string | null;

  @AllowNull
  @Column(TEXT)
  declare communityIncentives: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare budget: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare jobsCreatedGoal: number | null;

  @AllowNull
  @Column(DECIMAL(15, 1))
  declare totalHectaresRestoredGoal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare treesGrownGoal: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare survivalRate: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare yearFiveCrownCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare monitoredTreeCover: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare ppcExternalId: number | null;

  @AllowNull
  @JsonColumn({ type: TEXT("long") })
  declare answers: Dictionary<unknown> | null;

  @AllowNull
  @Column(TEXT)
  declare organizationName: string | null;

  @AllowNull
  @Column(TEXT)
  declare projectCountyDistrict: string | null;

  @AllowNull
  @Column(TEXT)
  declare descriptionOfProjectTimeline: string | null;

  @AllowNull
  @Column(TEXT)
  declare sitingStrategyDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare sitingStrategy: string | null;

  @AllowNull
  @JsonColumn()
  declare landTenureProjectArea: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare landholderCommEngage: string | null;

  @AllowNull
  @Column(TEXT)
  declare projPartnerInfo: string | null;

  @AllowNull
  @Column(TEXT)
  declare projSuccessRisks: string | null;

  @AllowNull
  @Column(TEXT)
  declare monitorEvalPlan: string | null;

  @AllowNull
  @Column(TEXT)
  declare seedlingsSource: string | null;

  @AllowNull
  @Column(TINYINT)
  declare pctEmployeesMen: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctEmployeesWomen: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_18to35" })
  declare pctEmployees18To35: number | null;

  @AllowNull
  @Column({ type: TINYINT, field: "pct_employees_older35" })
  declare pctEmployeesOlder35: number | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare projBeneficiaries: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesWomen: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesSmall: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesLarge: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesYouth: number | null;

  @AllowNull
  @JsonColumn()
  declare detailedInterventionTypes: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare projImpactFoodsec: string | null;

  @AllowNull
  @Column(TINYINT)
  declare pctEmployeesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesMarginalised: number | null;

  @AllowNull
  @Column(TINYINT)
  declare pctBeneficiariesMen: number | null;

  @AllowNull
  @Column(TEXT)
  declare proposedGovPartners: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare proposedNumNurseries: number | null;

  @AllowNull
  @Column(TEXT)
  declare projBoundary: string | null;

  @AllowNull
  @JsonColumn()
  declare states: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare projImpactBiodiv: string | null;

  @AllowNull
  @Column(TEXT)
  declare waterSource: string | null;

  @AllowNull
  @Column(TEXT)
  declare baselineBiodiversity: string | null;

  @AllowNull
  @Column(INTEGER)
  declare goalTreesRestoredPlanting: number | null;

  @AllowNull
  @Column(INTEGER)
  declare goalTreesRestoredAnr: number | null;

  @AllowNull
  @Column(INTEGER)
  declare goalTreesRestoredDirectSeeding: number | null;

  @AllowNull
  @Column(DECIMAL(10, 8))
  declare lat: number | null;

  @AllowNull
  @Column(DECIMAL(11, 8))
  declare long: number | null;

  @AllowNull
  @Column(STRING)
  declare landscape: string | null;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  declare directSeedingSurvivalRate: number | null;

  @AllowNull
  @Column(STRING)
  declare shortName: string | null;

  @AllowNull
  @JsonColumn({ field: "level_0_project" })
  declare level0Project: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_1_project" })
  declare level1Project: string[] | null;

  @AllowNull
  @JsonColumn({ field: "level_2_project" })
  declare level2Project: string[] | null;

  @AllowNull
  @Column(STRING(255))
  declare seedlingsProcurement: string | null;

  @AllowNull
  @Column(TEXT)
  declare jobsGoalDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare volunteersGoalDescription: string | null;

  @AllowNull
  @Column(TEXT)
  declare communityEngagementPlan: string | null;

  @AllowNull
  @Column(TEXT)
  declare directBeneficiariesGoalDescription: string | null;

  @Column({ type: TINYINT, defaultValue: 0 })
  declare elpProject: CreationOptional<number>;

  @AllowNull
  @Column(TEXT)
  declare consortium: string | null;

  @AllowNull
  @Column(STRING(255))
  declare landownerAgreement: string | null;

  @AllowNull
  @Column(INTEGER)
  declare nurserySeedlingsGoal: number | null;

  @AllowNull
  @JsonColumn()
  declare bioeconomyProductList: string[] | null;

  @AllowNull
  @Column(TEXT)
  declare bioeconomyProductDescription: string | null;

  @Column({ type: STRING(64), allowNull: false, defaultValue: POLYGON_DATA_SUBMISSION_DEFAULT })
  declare polygonDataSubmission: CreationOptional<string>;

  @Column({ type: BOOLEAN, allowNull: false, defaultValue: false })
  declare readyForBaseline: CreationOptional<boolean>;

  @BelongsTo(() => Organisation)
  declare organisation: Organisation | null;

  get organisationName() {
    return this.organisation?.name;
  }

  get organisationUuid(): string | undefined {
    return this.organisation?.uuid;
  }

  get organisationType() {
    return this.organisation?.type;
  }

  get organisationReadableType(): string | undefined {
    return this.organisation?.readableType;
  }

  @BelongsTo(() => Application)
  declare application: Application | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Project.LARAVEL_TYPE, collection: "tree-planted" }
  })
  declare treesPlanted: TreeSpecies[] | null;

  @HasMany(() => TreeSpecies, {
    foreignKey: "speciesableId",
    constraints: false,
    scope: { speciesable_type: Project.LARAVEL_TYPE, collection: "non-tree" }
  })
  declare nonTrees: TreeSpecies[] | null;

  @HasMany(() => ProjectReport)
  declare reports: ProjectReport[] | null;

  @HasMany(() => Site)
  declare sites: Site[] | null;

  @HasMany(() => Nursery)
  declare nurseries: Nursery[] | null;
}
