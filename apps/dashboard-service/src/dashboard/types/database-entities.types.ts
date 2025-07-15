export interface Project {
  id: number;
  uuid: string;
  name: string;
  country: string;
  frameworkKey: string;
  lat: number;
  long: number;
  treesGrownGoal: number;
  status: string;
  updateRequestStatus: string;
  shortName: string;
  plantingStartDate: Date;
  plantingEndDate: Date;
  continent: string;
  states: string[];
  projectCountyDistrict: string;
  budget: number;
  history: string;
  objectives: string;
  environmentalGoals: string;
  socioeconomicGoals: string;
  sdgsImpacted: string[];
  totalHectaresRestoredGoal: number;
  survivalRate: number;
  landUseTypes: string[];
  restorationStrategy: string;
  descriptionOfProjectTimeline: string;
  sitingStrategyDescription: string;
  sitingStrategy: string;
  landholderCommEngage: string;
  projPartnerInfo: string;
  seedlingsSource: string;
  landTenureProjectArea: string;
  projImpactBiodiv: string;
  projImpactFoodsec: string;
  proposedGovPartners: string;
  detailedInterventionTypes: string[];
  goalTreesRestoredAnr: number;
  directSeedingSurvivalRate: number;
  createdAt: Date;
  updatedAt: Date;
  organisation?: {
    uuid: string;
    name: string;
    type: string;
  };
}

export interface Site {
  approvedIdsSubquery: (projectId: number) => string;
  approvedUuidsSubquery: (projectId: number) => string;
  approved: () => {
    project: (projectId: number) => {
      count: () => Promise<number>;
    };
  };
}

export interface SitePolygon {
  active: () => {
    approved: () => {
      sites: (query: string) => {
        sum: (field: string) => Promise<number | null>;
      };
    };
  };
}

export interface TreeSpecies {
  visible: () => {
    collection: (type: string) => {
      siteReports: (query: string) => {
        sum: (field: string) => Promise<number | null>;
      };
    };
  };
}

export interface SiteReport {
  approvedIdsSubquery: (query: string) => string;
}
