import { Dictionary, uniq } from "lodash";

// This file is the source of truth for roles and permissions. Users hold a list of role names
// (`users.roles`), and their permissions are derived from that list using ROLES below.

export const PERMISSIONS = {
  "framework-ppc": "Framework PPC",
  "framework-terrafund": "Framework Terrafund",
  "framework-enterprises": "Framework Terrafund Enterprises",
  "framework-terrafund-landscapes": "Framework Terrafund Landscapes",
  "framework-terrafund-3": "Framework Terrafund 3",
  "framework-hbf": "Framework Harit Bharat Fund",
  "framework-epa-ghana-pilot": "Framework EPA Ghana Pilot",
  "framework-fundo-flora": "Framework Fundo Flora",
  "framework-fundo-flora-1": "Framework Fundo Flora 1",
  "framework-wcb": "Framework WCB",
  "framework-barka-fund": "Framework Barka Fund",
  "custom-forms-manage": "Manage custom forms",
  "users-manage": "Manage users",
  "monitoring-manage": "Manage monitoring",
  "reports-manage": "Manage Reports",
  "manage-own": "Manage own",
  "projects-read": "Read all projects",
  "polygons-manage": "Manage polygons",
  "polygons-manage-own": "Manage own polygons",
  "media-manage": "Manage media",
  "view-dashboard": "View dashboard",
  "projects-manage": "Manage projects"
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES = {
  "admin-super": [
    "framework-terrafund",
    "framework-ppc",
    "framework-enterprises",
    "framework-terrafund-landscapes",
    "framework-terrafund-3",
    "framework-hbf",
    "framework-epa-ghana-pilot",
    "framework-fundo-flora",
    "framework-fundo-flora-1",
    "framework-wcb",
    "framework-barka-fund",
    "custom-forms-manage",
    "users-manage",
    "monitoring-manage",
    "reports-manage"
  ],
  "admin-ppc": ["framework-ppc", "custom-forms-manage", "users-manage", "monitoring-manage", "reports-manage"],
  "admin-terrafund": [
    "framework-terrafund",
    "framework-enterprises",
    "framework-terrafund-landscapes",
    "framework-terrafund-3",
    "custom-forms-manage",
    "users-manage",
    "monitoring-manage",
    "reports-manage"
  ],
  "admin-hbf": ["framework-hbf", "custom-forms-manage", "users-manage", "monitoring-manage", "reports-manage"],
  "admin-epa-ghana-pilot": [
    "framework-epa-ghana-pilot",
    "custom-forms-manage",
    "users-manage",
    "monitoring-manage",
    "reports-manage"
  ],
  "admin-fundo-floral": [
    "framework-fundo-flora",
    "framework-fundo-flora-1",
    "custom-forms-manage",
    "users-manage",
    "monitoring-manage",
    "reports-manage"
  ],
  "admin-wcb": ["framework-wcb", "custom-forms-manage", "users-manage", "monitoring-manage", "reports-manage"],
  "admin-barka-fund": [
    "framework-barka-fund",
    "custom-forms-manage",
    "users-manage",
    "monitoring-manage",
    "reports-manage"
  ],
  "project-developer": ["manage-own"],
  "project-manager": ["projects-manage"],
  "greenhouse-service-account": ["projects-read", "polygons-manage-own", "media-manage"],
  "research-service-account": ["projects-read", "polygons-manage"],
  government: ["view-dashboard"],
  funder: ["view-dashboard"]
} as const satisfies Dictionary<readonly Permission[]>;

export type RoleSlug = keyof typeof ROLES;

export const ROLE_SLUGS = Object.keys(ROLES) as RoleSlug[];

/** User-facing display names for each role. */
export const ROLE_NAMES: Record<RoleSlug, string> = {
  "admin-super": "Super Admin",
  "admin-ppc": "PPC Admin",
  "admin-terrafund": "TerraFund Admin",
  "admin-hbf": "HBF Admin",
  "admin-epa-ghana-pilot": "EPA Ghana Pilot Admin",
  "admin-fundo-floral": "Fundo Flora Admin",
  "admin-wcb": "WCB Admin",
  "admin-barka-fund": "Barka Fund Admin",
  "project-developer": "Project Developer",
  "project-manager": "Project Manager",
  "greenhouse-service-account": "Greenhouse Service Account",
  "research-service-account": "Research Service Account",
  government: "Government",
  funder: "Funder"
};

export const isValidRole = (role: string): role is RoleSlug => ROLE_SLUGS.includes(role as RoleSlug);

export const getPermissionsForRoles = (roles: string[]) => uniq(roles.filter(isValidRole).flatMap(role => ROLES[role]));
