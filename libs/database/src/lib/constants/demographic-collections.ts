import { Demographic } from "../entities";
import { DemographicType } from "../types/demographic";
import { Dictionary } from "factory-girl-ts";

export const PAID_NURSERY_OPERATIONS = "paid-nursery-operations";
export const PAID_PROJECT_MANAGEMENT = "paid-project-management";
export const PAID_OTHER = "paid-other-activities";
export const VOLUNTEER_NURSERY_OPERATIONS = "volunteer-nursery-operations";
export const VOLUNTEER_PROJECT_MANAGEMENT = "volunteer-project-management";
export const VOLUNTEER_OTHER = "volunteer-other-activities";
export const DIRECT = "direct";
export const CONVERGENCE = "convergence";
export const PAID_SITE_ESTABLISHMENT = "paid-site-establishment";
export const PAID_PLANTING = "paid-planting";
export const PAID_SITE_MAINTENANCE = "paid-site-maintenance";
export const PAID_SITE_MONITORING = "paid-site-monitoring";
export const VOLUNTEER_SITE_ESTABLISHMENT = "volunteer-site-establishment";
export const VOLUNTEER_PLANTING = "volunteer-planting";
export const VOLUNTEER_SITE_MAINTENANCE = "volunteer-site-maintenance";
export const VOLUNTEER_SITE_MONITORING = "volunteer-site-monitoring";

// The order of these arrays dictates the order of display in the PD views.
export const WORKDAYS_PROJECT_COLLECTIONS = [
  PAID_PROJECT_MANAGEMENT,
  VOLUNTEER_PROJECT_MANAGEMENT,
  PAID_NURSERY_OPERATIONS,
  VOLUNTEER_NURSERY_OPERATIONS,
  PAID_OTHER,
  VOLUNTEER_OTHER,
  DIRECT,
  CONVERGENCE
] as const;

export const WORKDAYS_SITE_COLLECTIONS = [
  PAID_SITE_ESTABLISHMENT,
  VOLUNTEER_SITE_ESTABLISHMENT,
  PAID_PLANTING,
  VOLUNTEER_PLANTING,
  PAID_SITE_MAINTENANCE,
  VOLUNTEER_SITE_MAINTENANCE,
  PAID_SITE_MONITORING,
  VOLUNTEER_SITE_MONITORING,
  PAID_OTHER,
  VOLUNTEER_OTHER
] as const;

export type WorkdayCollection =
  | (typeof WORKDAYS_PROJECT_COLLECTIONS)[number]
  | (typeof WORKDAYS_SITE_COLLECTIONS)[number];

export const DIRECT_INCOME = "direct-income";
export const INDIRECT_INCOME = "indirect-income";
export const DIRECT_BENEFITS = "direct-benefits";
export const INDIRECT_BENEFITS = "indirect-benefits";
export const DIRECT_CONSERVATION_PAYMENTS = "direct-conservation-payments";
export const INDIRECT_CONSERVATION_PAYMENTS = "indirect-conservation-payments";
export const DIRECT_MARKET_ACCESS = "direct-market-access";
export const INDIRECT_MARKET_ACCESS = "indirect-market-access";
export const DIRECT_CAPACITY = "direct-capacity";
export const INDIRECT_CAPACITY = "indirect-capacity";
export const DIRECT_TRAINING = "direct-training";
export const INDIRECT_TRAINING = "indirect-training";
export const DIRECT_LAND_TITLE = "direct-land-title";
export const INDIRECT_LAND_TITLE = "indirect-land-title";
export const DIRECT_LIVELIHOODS = "direct-livelihoods";
export const INDIRECT_LIVELIHOODS = "indirect-livelihoods";
export const DIRECT_PRODUCTIVITY = "direct-productivity";
export const INDIRECT_PRODUCTIVITY = "indirect-productivity";
export const DIRECT_OTHER = "direct-other";
export const INDIRECT_OTHER = "indirect-other";
export const RESTORATION_PARTNERS_PROJECT_COLLECTIONS = [
  DIRECT_INCOME,
  INDIRECT_INCOME,
  DIRECT_BENEFITS,
  INDIRECT_BENEFITS,
  DIRECT_CONSERVATION_PAYMENTS,
  INDIRECT_CONSERVATION_PAYMENTS,
  DIRECT_MARKET_ACCESS,
  INDIRECT_MARKET_ACCESS,
  DIRECT_CAPACITY,
  INDIRECT_CAPACITY,
  DIRECT_TRAINING,
  INDIRECT_TRAINING,
  DIRECT_LAND_TITLE,
  INDIRECT_LAND_TITLE,
  DIRECT_LIVELIHOODS,
  INDIRECT_LIVELIHOODS,
  DIRECT_PRODUCTIVITY,
  INDIRECT_PRODUCTIVITY,
  DIRECT_OTHER,
  INDIRECT_OTHER
] as const;

export type RestorationPartnerCollection = (typeof RESTORATION_PARTNERS_PROJECT_COLLECTIONS)[number];

export const FULL_TIME = "full-time";
export const PART_TIME = "part-time";
export const JOBS_PROJECT_COLLECTIONS = [FULL_TIME, PART_TIME] as const;

export type JobsCollection = (typeof JOBS_PROJECT_COLLECTIONS)[number];

export const VOLUNTEER = "volunteer";
export const VOLUNTEERS_PROJECT_COLLECTIONS = [VOLUNTEER] as const;

export type VolunteersCollection = (typeof VOLUNTEERS_PROJECT_COLLECTIONS)[number];

export const ALL = "all";
export const ALL_BENEFICIARIES_PROJECT_COLLECTIONS = [ALL] as const;

export type AllBeneficiariesCollection = (typeof ALL_BENEFICIARIES_PROJECT_COLLECTIONS)[number];

export const TRAINING = "training";
export const TRAINING_BENEFICIARIES_PROJECT_COLLECTIONS = [TRAINING] as const;

export type TrainingBeneficiariesCollection = (typeof TRAINING_BENEFICIARIES_PROJECT_COLLECTIONS)[number];

// Type ensures that if a new collection or demographic type is added, there will be a compile time
// error if a title mapping is added as well.
type CollectionTitleSet = Record<DemographicType, Dictionary<string>> & {
  workdays: Record<WorkdayCollection, string>;
  "restoration-partners": Record<RestorationPartnerCollection, string>;
  jobs: Record<JobsCollection, string>;
  volunteers: Record<VolunteersCollection, string>;
  "all-beneficiaries": Record<AllBeneficiariesCollection, string>;
  "training-beneficiaries": Record<TrainingBeneficiariesCollection, string>;
};

// This is only used in demographic.dto.ts to send this mapping to the FE, but specifying it here
// allows us to avoid a huge pile of imports in that file.
export const COLLECTION_TITLES: CollectionTitleSet = {
  [Demographic.WORKDAYS_TYPE]: {
    [PAID_PROJECT_MANAGEMENT]: "Paid Project Management",
    [VOLUNTEER_PROJECT_MANAGEMENT]: "Volunteer Project Management",
    [PAID_NURSERY_OPERATIONS]: "Paid Nursery Operations",
    [VOLUNTEER_NURSERY_OPERATIONS]: "Volunteer Nursery Operations",
    [PAID_OTHER]: "Paid Other Activities",
    [VOLUNTEER_OTHER]: "Volunteer Other Activities",
    [DIRECT]: "Direct Workdays",
    [CONVERGENCE]: "Convergence Workdays",
    [PAID_SITE_ESTABLISHMENT]: "Paid Site Establishment",
    [VOLUNTEER_SITE_ESTABLISHMENT]: "Volunteer Site Establishment",
    [PAID_PLANTING]: "Paid Planting",
    [VOLUNTEER_PLANTING]: "Volunteer Planting",
    [PAID_SITE_MAINTENANCE]: "Paid Site Maintenance",
    [VOLUNTEER_SITE_MAINTENANCE]: "Volunteer Site Maintenance",
    [PAID_SITE_MONITORING]: "Paid Site Monitoring",
    [VOLUNTEER_SITE_MONITORING]: "Volunteer Site Monitoring"
  },
  [Demographic.RESTORATION_PARTNERS_TYPE]: {
    [DIRECT_INCOME]: "Direct Income",
    [INDIRECT_INCOME]: "Indirect Income",
    [DIRECT_BENEFITS]: "Direct In-kind Benefits",
    [INDIRECT_BENEFITS]: "Indirect In-kind Benefits",
    [DIRECT_CONSERVATION_PAYMENTS]: "Direct Conservation Agreement Payments",
    [INDIRECT_CONSERVATION_PAYMENTS]: "Indirect Conservation Agreement Payments",
    [DIRECT_MARKET_ACCESS]: "Direct Increased Market Access",
    [INDIRECT_MARKET_ACCESS]: "Indirect Increased Market Access",
    [DIRECT_CAPACITY]: "Direct Increased Capacity",
    [INDIRECT_CAPACITY]: "Indirect Increased Capacity",
    [DIRECT_TRAINING]: "Direct Training",
    [INDIRECT_TRAINING]: "Indirect Training",
    [DIRECT_LAND_TITLE]: "Direct Newly Secured Land Title",
    [INDIRECT_LAND_TITLE]: "Indirect Newly Secured Land Title",
    [DIRECT_LIVELIHOODS]: "Direct Traditional Livelihoods or Customer Rights",
    [INDIRECT_LIVELIHOODS]: "Indirect Traditional Livelihoods or Customer Rights",
    [DIRECT_PRODUCTIVITY]: "Direct Increased Productivity",
    [INDIRECT_PRODUCTIVITY]: "Indirect Increased Productivity",
    [DIRECT_OTHER]: "Direct Other",
    [INDIRECT_OTHER]: "Indirect Other"
  },
  [Demographic.JOBS_TYPE]: {
    [FULL_TIME]: "Full-time",
    [PART_TIME]: "Part-time"
  },
  [Demographic.VOLUNTEERS_TYPE]: {
    [VOLUNTEER]: "Volunteer"
  },
  [Demographic.ALL_BENEFICIARIES_TYPE]: {
    [ALL]: "All Beneficiaries"
  },
  [Demographic.TRAINING_BENEFICIARIES_TYPE]: {
    [TRAINING]: "Training Beneficiaries"
  }
};
