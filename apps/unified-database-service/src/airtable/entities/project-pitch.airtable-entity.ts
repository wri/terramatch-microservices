import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { filter, flatten, uniq } from "lodash";

type ProjectPitchAssociations = {
  projectCountryName: string;
  stateNames: string[];
};

const COLUMNS: ColumnMapping<ProjectPitch, ProjectPitchAssociations>[] = [
  ...commonEntityColumns<ProjectPitch, ProjectPitchAssociations>("pitch"),
  "totalTrees",
  "totalHectares",
  "restorationInterventionTypes",
  "landUseTypes",
  "restorationStrategy",
  "projectObjectives",
  "projectCountry",
  associatedValueColumn("projectCountryName", "projectCountry"),
  "states",
  associatedValueColumn("stateNames", "states"),
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

export class ProjectPitchEntity extends AirtableEntity<ProjectPitch, ProjectPitchAssociations> {
  readonly TABLE_NAME = "Project Pitches";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectPitch;

  async loadAssociations(pitches: ProjectPitch[]) {
    const countryNames = await this.gadmLevel0Names();
    const stateCountries = filter(
      uniq(flatten(pitches.map(({ states }) => states?.map(state => state.split(".")[0]))))
    );
    const stateNames = await this.gadmLevel1Names(stateCountries);

    return pitches.reduce(
      (associations, { id, projectCountry, states }) => ({
        ...associations,
        [id]: {
          projectCountryName: projectCountry == null ? null : countryNames[projectCountry],
          stateNames: filter(states?.map(state => stateNames[state]))
        }
      }),
      {} as Record<number, ProjectPitchAssociations>
    );
  }
}
