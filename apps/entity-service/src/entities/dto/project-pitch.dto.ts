import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

@JsonApiDto({ type: "projectPitches" })
export class ProjectPitchDto {
  constructor(data: Partial<ProjectPitchDto>) {
    Object.assign(this, data);
  }

  @ApiProperty()
  @IsUUID()
  uuid: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capacityBuildingNeeds: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalTrees: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalHectares: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restorationInterventionTypes: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  landUseTypes: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restorationStrategy: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectCountyDistrict: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectCountry: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectObjectives: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectName: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  organisationId: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fundingProgrammeId: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  projectBudget: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  howDiscovered: string[] | null;

  @ApiProperty()
  @IsString()
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  expectedActiveRestorationStartDate: Date | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  expectedActiveRestorationEndDate: Date | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionOfProjectTimeline: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projPartnerInfo: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  landTenureProjArea: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  landholderCommEngage: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projSuccessRisks: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  monitorEvalPlan: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projBoundary: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sustainableDevGoals: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projAreaDescription: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  environmentalGoals: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  proposedNumSites: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  proposedNumNurseries: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currLandDegradation: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mainDegradationCauses: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  seedlingsSource: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projImpactSocieconom: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projImpactFoodsec: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projImpactWatersec: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projImpactJobtypes: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  numJobsCreated: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctEmployeesMen: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctEmployeesWomen: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctEmployees18To35: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctEmployeesOlder35: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  projBeneficiaries: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctBeneficiariesWomen: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctBeneficiariesSmall: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctBeneficiariesLarge: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctBeneficiariesYouth: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mainCausesOfDegradation: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hectaresFirstYr: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalTreesFirstYr: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pctBeneficiariesBackwardClass: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  landSystems: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  treeRestorationPractices: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detailedInterventionTypes: string[] | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  monitoringEvaluationPlan: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pctBeneficiariesScheduledClasses: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pctBeneficiariesScheduledTribes: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  theoryOfChange: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  proposedGovPartners: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pctSchTribe: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sustainabilityPlan: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  replicationPlan: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  replicationChallenges: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  solutionMarketSite: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  affordabilityOfSolution: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  growthTrendsBusiness: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  limitationsOnScope: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessModelReplicationPlan: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  biodiversityImpact: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  waterSource: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  climateResilience: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  soilHealth: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctEmployeesMarginalised: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctBeneficiariesMarginalised: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pctBeneficiariesMen: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  baselineBiodiversity: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  goalTreesRestoredPlanting: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  goalTreesRestoredAnr: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  goalTreesRestoredDirectSeeding: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  directSeedingSurvivalRate: number | null;
}
