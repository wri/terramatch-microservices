import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  treeAmountRollup,
  treeDescriptionRollup,
  UpdateAssociation
} from "./airtable-entity";
import { ProjectPitch, TreeSpecies } from "@terramatch-microservices/database/entities";
import { filter, flatten, groupBy, uniq } from "lodash";

type ProjectPitchAssociations = {
  projectCountryName: string | null;
  stateNames: string[];
  level0ProposedNames: string[];
  level1ProposedNames: string[];
  level2ProposedNames: string[];
  treePlantedAmount: number | null;
  treePlantedNameAndAmount: string;
};

const COLUMNS: ColumnMapping<ProjectPitch, ProjectPitchAssociations>[] = [
  ...commonEntityColumns<ProjectPitch, ProjectPitchAssociations>("pitch"),
  {
    airtableColumn: "organisationUuid",
    dbColumn: "organisationId",
    valueMap: async ({ organisationId }) => organisationId
  },
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
  "goalTreesRestoredDirectSeeding",
  "level0Proposed",
  associatedValueColumn("level0ProposedNames", "level0Proposed"),
  "level1Proposed",
  associatedValueColumn("level1ProposedNames", "level1Proposed"),
  "level2Proposed",
  associatedValueColumn("level2ProposedNames", "level2Proposed"),
  "latProposed",
  "lngProposed",
  "stakeholderEngagement",
  "landownerAgreement",
  "landownerAgreementDescription",
  "landTenureDistribution",
  "landTenureRisks",
  "nonTreeInterventionsDescription",
  "complementExistingRestoration",
  "landUseTypeDistribution",
  "restorationStrategyDistribution",
  "totalTreeSecondYr",
  "projSurvivalRate",
  "anrApproach",
  "anrRights",
  "projectSiteModel",
  "indigenousImpact",
  "barriersProjectActivity",
  "barriersProjectActivityDescription",
  "otherEngageWomenYouth",
  "anrPracticesProposed",
  "goalTreesRestoredAnr",
  "consortium",
  "goalTreesRestoredDescription",
  "jobsCreatedBeneficiariesDescription",
  associatedValueColumn("treePlantedAmount"),
  associatedValueColumn("treePlantedNameAndAmount")
];

const TREE_ASSOCIATION: UpdateAssociation<ProjectPitch, TreeSpecies> = {
  model: TreeSpecies,
  on: ["id", "speciesableId"],
  scope: {
    speciesableType: ProjectPitch.LARAVEL_TYPE
  }
};

export class ProjectPitchEntity extends AirtableEntity<ProjectPitch, ProjectPitchAssociations> {
  readonly TABLE_NAME = "Project Pitches";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectPitch;
  readonly UPDATE_ASSOCIATIONS = [TREE_ASSOCIATION];

  async loadAssociations(pitches: ProjectPitch[]) {
    const countryNames = await this.gadmLevel0Names();
    const stateCountries = filter(
      uniq(flatten(pitches.map(({ states }) => states?.map(state => state.split(".")[0]))))
    ) as string[];
    const stateNames = await this.gadmLevel1Names(stateCountries);
    const level1Parents = filter(
      uniq(flatten(pitches.map(({ level1Proposed }) => level1Proposed?.map(code => code.split(".")[0]))))
    ) as string[];
    const leve1Names = await this.gadmLevel1Names(level1Parents);
    // for level 2, we can't trivially extract the parent code from the child codes, so we have to work with the assumption
    // that the data is clean and the level 2 codes are all a direct child of one of the selected level 1 codes.
    const level2Parents = filter(uniq(flatten(pitches.map(({ level1Proposed }) => level1Proposed)))) as string[];
    const level2Names = await this.gadmLevel2Names(level2Parents);
    const treesByPitch = groupBy(await TreeSpecies.visible().for(pitches).findAll(), "speciesableId");

    return pitches.reduce(
      (associations, { id, projectCountry, states, level0Proposed, level1Proposed, level2Proposed }) => ({
        ...associations,
        [id]: {
          projectCountryName: projectCountry == null ? null : countryNames[projectCountry],
          stateNames: filter(states?.map(state => stateNames[state])),
          level0ProposedNames: filter((level0Proposed ?? []).map(code => countryNames[code])),
          level1ProposedNames: filter((level1Proposed ?? []).map(code => leve1Names[code])),
          level2ProposedNames: filter((level2Proposed ?? []).map(code => level2Names[code])),
          treePlantedAmount: treeAmountRollup(treesByPitch[id], "tree-planted"),
          treePlantedNameAndAmount: treeDescriptionRollup(treesByPitch[id], "tree-planted")
        }
      }),
      {} as Record<number, ProjectPitchAssociations>
    );
  }
}
