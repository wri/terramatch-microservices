import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ProjectPitch } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "projectPitches" })
export class ProjectPitchDto {
  constructor(data: ProjectPitch) {
    populateDto<ProjectPitchDto>(this, data as ProjectPitchDto);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  capacityBuildingNeeds: string[] | null;

  @ApiProperty({ nullable: true, type: Number })
  totalTrees: number | null;

  @ApiProperty({ nullable: true, type: Number })
  totalHectares: number | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  restorationInterventionTypes: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landUseTypes: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  restorationStrategy: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  projectCountyDistrict: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectCountry: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectObjectives: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationId: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeId: string | null;

  @ApiProperty({ nullable: true, type: Number })
  projectBudget: number | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  howDiscovered: string[] | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true, type: Date })
  expectedActiveRestorationStartDate: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  expectedActiveRestorationEndDate: Date | null;

  @ApiProperty({ nullable: true, type: String })
  descriptionOfProjectTimeline: string | null;

  @ApiProperty({ nullable: true, type: String })
  projPartnerInfo: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landTenureProjArea: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  landholderCommEngage: string | null;

  @ApiProperty({ nullable: true, type: String })
  projSuccessRisks: string | null;

  @ApiProperty({ nullable: true, type: String })
  monitorEvalPlan: string | null;

  @ApiProperty({ nullable: true, type: String })
  projBoundary: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  sustainableDevGoals: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  projAreaDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  environmentalGoals: string | null;

  @ApiProperty({ nullable: true, type: Number })
  proposedNumSites: number | null;

  @ApiProperty({ nullable: true, type: Number })
  proposedNumNurseries: number | null;

  @ApiProperty({ nullable: true, type: String })
  currLandDegradation: string | null;

  @ApiProperty({ nullable: true, type: String })
  mainDegradationCauses: string | null;

  @ApiProperty({ nullable: true, type: String })
  seedlingsSource: string | null;

  @ApiProperty({ nullable: true, type: String })
  projImpactSocieconom: string | null;

  @ApiProperty({ nullable: true, type: String })
  projImpactFoodsec: string | null;

  @ApiProperty({ nullable: true, type: String })
  projImpactWatersec: string | null;

  @ApiProperty({ nullable: true, type: String })
  projImpactJobtypes: string | null;

  @ApiProperty({ nullable: true, type: Number })
  numJobsCreated: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctEmployeesMen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctEmployeesWomen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctEmployees18To35: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctEmployeesOlder35: number | null;

  @ApiProperty({ nullable: true, type: Number })
  projBeneficiaries: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesWomen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesSmall: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesLarge: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesYouth: number | null;

  @ApiProperty({ nullable: true, type: String })
  mainCausesOfDegradation: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  states: string[] | null;

  @ApiProperty({ nullable: true, type: Number })
  hectaresFirstYr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  totalTreesFirstYr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesBackwardClass: number | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landSystems: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  treeRestorationPractices: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  detailedInterventionTypes: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  monitoringEvaluationPlan: string | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesScheduledClasses: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesScheduledTribes: number | null;

  @ApiProperty({ nullable: true, type: String })
  theoryOfChange: string | null;

  @ApiProperty({ nullable: true, type: String })
  proposedGovPartners: string | null;

  @ApiProperty({ nullable: true, type: String })
  pctSchTribe: string | null;

  @ApiProperty({ nullable: true, type: String })
  sustainabilityPlan: string | null;

  @ApiProperty({ nullable: true, type: String })
  replicationPlan: string | null;

  @ApiProperty({ nullable: true, type: String })
  replicationChallenges: string | null;

  @ApiProperty({ nullable: true, type: String })
  solutionMarketSize: string | null;

  @ApiProperty({ nullable: true, type: String })
  affordabilityOfSolution: string | null;

  @ApiProperty({ nullable: true, type: String })
  growthTrendsBusiness: string | null;

  @ApiProperty({ nullable: true, type: String })
  limitationsOnScope: string | null;

  @ApiProperty({ nullable: true, type: String })
  businessModelReplicationPlan: string | null;

  @ApiProperty({ nullable: true, type: String })
  biodiversityImpact: string | null;

  @ApiProperty({ nullable: true, type: String })
  waterSource: string | null;

  @ApiProperty({ nullable: true, type: String })
  climateResilience: string | null;

  @ApiProperty({ nullable: true, type: String })
  soilHealth: string | null;

  @ApiProperty({ nullable: true, type: Number })
  pctEmployeesMarginalised: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesMarginalised: number | null;

  @ApiProperty({ nullable: true, type: Number })
  pctBeneficiariesMen: number | null;

  @ApiProperty({ nullable: true, type: String })
  baselineBiodiversity: string | null;

  @ApiProperty({ nullable: true, type: Number })
  goalTreesRestoredPlanting: number | null;

  @ApiProperty({ nullable: true, type: Number })
  goalTreesRestoredAnr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  goalTreesRestoredDirectSeeding: number | null;

  @ApiProperty({ nullable: true, type: Number })
  directSeedingSurvivalRate: number | null;

  @ApiProperty()
  createdAt: Date;
}
