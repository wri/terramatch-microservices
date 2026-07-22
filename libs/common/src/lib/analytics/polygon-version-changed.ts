import { isApiPartnerSource } from "./polygon-pushed-via-api";

export const POLYGON_VERSION_CHANGED_EVENT = "polygon_version_changed";

export const DUPLICATE_VERSION_CHANGE_REASON = "Duplicate version";
export const GEOMETRY_UPLOAD_CHANGE_REASON = "Version created from geometry file upload";

export type PolygonVersionChangeSource =
  | "admin_action"
  | "shape_edit"
  | "attribute_edit"
  | "geometry_upload"
  | "api_push"
  | "duplicate";

export type PolygonVersionChangedParams = {
  polygon_id: string;
  entity_id: string;
  entity_type: "site";
  previous_version: string;
  new_version: string;
  change_source: PolygonVersionChangeSource;
};

export type PolygonVersionChangeContext = {
  changeReason: string;
  newPolygonGeometryUuid: string | null;
  source?: string;
  isAdminSession?: boolean;
};

export const isAdminSessionFromRoles = (roles: ReadonlyArray<{ name: string }> | null | undefined): boolean =>
  roles?.some(({ name }) => name.startsWith("admin-")) ?? false;

export const isDuplicateVersionChangeReason = (changeReason: string): boolean =>
  changeReason === DUPLICATE_VERSION_CHANGE_REASON || changeReason.startsWith(`${DUPLICATE_VERSION_CHANGE_REASON} `);

export const isGeometryUploadChangeReason = (changeReason: string): boolean =>
  changeReason === GEOMETRY_UPLOAD_CHANGE_REASON || changeReason.startsWith(`${GEOMETRY_UPLOAD_CHANGE_REASON} `);

export const resolvePolygonVersionChangeSource = (context: PolygonVersionChangeContext): PolygonVersionChangeSource => {
  const { changeReason, newPolygonGeometryUuid, source = "terramatch", isAdminSession = false } = context;

  if (isDuplicateVersionChangeReason(changeReason)) {
    return "duplicate";
  }

  if (isApiPartnerSource(source)) {
    return "api_push";
  }

  if (isGeometryUploadChangeReason(changeReason)) {
    return "geometry_upload";
  }

  if (isAdminSession) {
    return "admin_action";
  }

  if (newPolygonGeometryUuid != null) {
    return "shape_edit";
  }

  return "attribute_edit";
};

export const buildPolygonVersionChangedParams = (
  basePolygon: {
    uuid: string;
    primaryUuid: string | null;
    siteUuid: string | null;
  },
  newVersion: { uuid: string },
  context: PolygonVersionChangeContext
): PolygonVersionChangedParams | null => {
  const { primaryUuid, siteUuid, uuid: previousVersion } = basePolygon;

  if (primaryUuid == null || siteUuid == null) {
    return null;
  }

  return {
    polygon_id: primaryUuid,
    entity_id: siteUuid,
    entity_type: "site",
    previous_version: previousVersion,
    new_version: newVersion.uuid,
    change_source: resolvePolygonVersionChangeSource(context)
  };
};
