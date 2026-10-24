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

export const projectContextIdsSubquery = (
  { frameworkKey, country, organisationUuid, plantingStatus }: SitePolygonProjectFiltersDto,
  excludeTestProjects: boolean
) => {
  const projectIds = Subquery.select(Project, "id");
  if (frameworkKey != null && frameworkKey.length > 0) projectIds.in("frameworkKey", frameworkKey);
  if (country != null && country.length > 0) {
    // Projects are single-country for now: match only the first level0Project entry, which is the one displayed.
    const clauses = Subquery.clauseBuilder(Project);
    const countries = country.map(code => clauses.escape(code)).join(",");
    projectIds.andLiteral(`JSON_UNQUOTE(JSON_EXTRACT(${clauses.field("level0Project")}, '$[0]')) IN (${countries})`);
  }
  if (organisationUuid != null && organisationUuid.length > 0) {
    projectIds.in("organisationId", Subquery.select(Organisation, "id").in("uuid", organisationUuid).literal);
  }
  if (plantingStatus != null) {
    projectIds.in("uuid", ProjectReport.projectUuidsForLatestApprovedPlantingStatus(plantingStatus));
  }
  if (excludeTestProjects) projectIds.eq("isTest", false);

  return projectIds.literal;
};
