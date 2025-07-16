/**
 * TerraMatch Field Planting Status Constants
 *
 * These statuses represent the current state of restoration activities
 * for projects, sites, nurseries, and site polygons.
 */
export const PLANTING_STATUSES = [
  "no-restoration-expected", // For projects that are neither planting trees nor undergoing ANR
  "not-started", // Profile created but restoration has not started yet
  "in-progress", // Restoration is currently in progress
  "disturbed", // Entity affected by disturbance, halting restoration (Polygon only)
  "replacement-planting", // Replacement planting (replanting) of damaged areas in progress
  "completed" // Restoration activity has been completed
] as const;

export type PlantingStatus = (typeof PLANTING_STATUSES)[number];
