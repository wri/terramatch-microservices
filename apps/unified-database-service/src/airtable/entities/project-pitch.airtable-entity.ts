import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { ProjectPitch } from "@terramatch-microservices/database/entities";

const COLUMNS: ColumnMapping<ProjectPitch>[] = [
  ...commonEntityColumns<ProjectPitch>("pitch"),
  "totalTrees",
  "totalHectares",
  "restorationInterventionTypes",
  "landUseTypes",
  "restorationStrategy",
  "projectObjectives",
  "projectCountry",
  "projectName",
  "projectBudget",
  "status",
  "expectedActiveRestorationStartDate",
  "expectedActiveRestorationEndDate",
  "descriptionOfProjectTimeline",
  "landholderCommEngage",
  "landTenureProjArea",
  "projSuccessRisks",
  "projPartnerInfo",
  "monitorEvalPlan",
  "projAreaDescription",
  "environmentalGoals",
  "proposedNumSites",
  "proposedNumNurseries",
  "currLandDegradation",
  "mainCausesOfDegradation",
  "projImpactSocieconom",
  "projImpactFoodsec",
  "projImpactWatersec",
  "projImpactJobtypes",
  "hectaresFirstYr",
  "totalTreesFirstYr",
  "landSystems",
  "treeRestorationPractices",
  "detailedInterventionTypes",
  "monitoringEvaluationPlan",
  "seedlingsSource",
  "directSeedingSurvivalRate",
  "goalTreesRestoredPlanting",
  "goalTreesRestoredDirectSeeding"
];

export class ProjectPitchEntity extends AirtableEntity<ProjectPitch> {
  readonly TABLE_NAME = "Project Pitches";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectPitch;
}
