export const CLUSTER = "terramatch-microservices";

export const SERVICES = [
  "entity-service",
  "user-service",
  "job-service",
  "research-service",
  "unified-database-service",
  "dashboard-service"
] as const;
export type Service = (typeof SERVICES)[number];

export const ENVIRONMENTS = ["prod", "staging", "test", "dev", "local"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];
