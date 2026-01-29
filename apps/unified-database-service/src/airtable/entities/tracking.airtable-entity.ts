import { AirtableEntity, associatedValueColumn, ColumnMapping, PolymorphicUuidAssociation } from "./airtable-entity";
import {
  ProjectReport,
  SiteReport,
  Tracking,
  Organisation,
  ProjectPitch,
  Project
} from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPINGS: Record<string, PolymorphicUuidAssociation<TrackingAssociations>> = {
  [ProjectReport.LARAVEL_TYPE]: {
    association: "projectReportUuid",
    model: ProjectReport
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  },
  [Organisation.LARAVEL_TYPE]: {
    association: "organisationUuid",
    model: Organisation
  },
  [ProjectPitch.LARAVEL_TYPE]: {
    association: "projectPitchUuid",
    model: ProjectPitch
  },
  [Project.LARAVEL_TYPE]: {
    association: "projectUuid",
    model: Project
  }
};

type TrackingAssociations = {
  projectReportUuid?: string;
  siteReportUuid?: string;
  organisationUuid?: string;
  projectPitchUuid?: string;
  projectUuid?: string;
};

const COLUMNS: ColumnMapping<Tracking, TrackingAssociations>[] = [
  "uuid",
  "domain",
  "type",
  "collection",
  "description",
  associatedValueColumn("projectReportUuid", ["trackableId", "trackableType"]),
  associatedValueColumn("siteReportUuid", ["trackableId", "trackableType"]),
  associatedValueColumn("organisationUuid", ["trackableId", "trackableType"]),
  associatedValueColumn("projectPitchUuid", ["trackableId", "trackableType"]),
  associatedValueColumn("projectUuid", ["trackableId", "trackableType"])
];

export class TrackingEntity extends AirtableEntity<Tracking, TrackingAssociations> {
  readonly TABLE_NAME = "Trackings";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Tracking;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(demographics: Tracking[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPINGS, "trackableType", "trackableId", demographics);
  }
}
