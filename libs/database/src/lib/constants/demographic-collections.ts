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

export const ALL = "all";
export const FULL_TIME = "full-time";
export const FULL_TIME_CLT = "full-time-clt";
export const PART_TIME = "part-time";
export const PART_TIME_CLT = "part-time-clt";
export const JOBS_PROJECT_COLLECTIONS = [ALL, FULL_TIME, PART_TIME] as const;

export const VOLUNTEER = "volunteer";
export const VOLUNTEERS_PROJECT_COLLECTIONS = [VOLUNTEER] as const;

export const ALL_BENEFICIARIES_PROJECT_COLLECTIONS = [ALL] as const;
export const ALL_BENEFICIARIES_ORGANISATION_COLLECTIONS = [ALL] as const;

export const TRAINING = "training";
export const TRAINING_BENEFICIARIES_PROJECT_COLLECTIONS = [TRAINING] as const;
