import { isEmpty } from "lodash";
import { Organisation, Project, ProjectReport } from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { SitePolygonProjectFiltersDto } from "./dto/site-polygon-project-filters.dto";

export const hasProjectContextFilters = ({
  frameworkKey,
  country,
  organisationUuid,
  plantingStatus
}: SitePolygonProjectFiltersDto) =>
  !isEmpty(frameworkKey) || !isEmpty(country) || !isEmpty(organisationUuid) || plantingStatus != null;

/**
 * Subquery for the ids of the projects that match the project context filters. Shared by the site
 * polygon endpoints and the project map index so both scope projects the same way.
 */
export const projectContextIdsSubquery = (
  { frameworkKey, country, organisationUuid, plantingStatus }: SitePolygonProjectFiltersDto,
  excludeTestProjects: boolean
) => {
  const projectIds = Subquery.select(Project, "id");
  if (frameworkKey != null && frameworkKey.length > 0) projectIds.in("frameworkKey", frameworkKey);
  if (country != null && country.length > 0) projectIds.in("country", country);
  if (organisationUuid != null && organisationUuid.length > 0) {
    projectIds.in("organisationId", Subquery.select(Organisation, "id").in("uuid", organisationUuid).literal);
  }
  if (plantingStatus != null) {
    projectIds.in("uuid", ProjectReport.projectUuidsForLatestApprovedPlantingStatus(plantingStatus));
  }
  if (excludeTestProjects) projectIds.eq("isTest", false);

  return projectIds.literal;
};
