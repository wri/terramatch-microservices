import { Injectable } from "@nestjs/common";
import { intersection } from "lodash";
import { col, fn, literal, Op, WhereOptions } from "sequelize";
import { Project } from "@terramatch-microservices/database/entities";
import type { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { projectContextIdsSubquery } from "../site-polygons/project-context-filters";
import { ProjectFilterOptionsQueryDto } from "./dto/project-filter-options-query.dto";
import { ProjectFilterOptionsDto } from "./dto/project-filter-options.dto";

type FilterFacet = "frameworkKey" | "country" | "organisationUuid" | "projectUuid";

type CountRow = { count: number | string };
type FrameworkRow = CountRow & { frameworkKey: FrameworkKey | null };
type CountryRow = CountRow & { value: string | null };
type OrganisationRow = CountRow & { uuid: string; name: string | null };

const COUNTRY_CODE_SQL = "JSON_UNQUOTE(JSON_EXTRACT(`Project`.`level_0_project`, '$[0]'))";

/** Case-insensitive partial match. MySQL's default collation makes LIKE case-insensitive. */
const containsSearch = (search: string | undefined) => {
  const term = search?.trim();
  if (term == null || term === "") return undefined;
  return { [Op.like]: `%${term.replace(/[\\%_]/g, "\\$&")}%` };
};

/**
 * Framework keys the caller may see, combined with the requested keys. Null means no framework restriction.
 * An empty array means nothing is accessible for this request.
 */
const scopedFrameworkKeys = (
  requested: FrameworkKey[] | undefined,
  frameworkScope: FrameworkKey[] | null
): FrameworkKey[] | undefined => {
  if (frameworkScope == null) return requested;
  return requested == null || requested.length === 0 ? frameworkScope : intersection(requested, frameworkScope);
};

/**
 * The filters that apply to one facet's options: every selection except the facet's own, so that picking a value
 * narrows the other facets without hiding the rest of its own options. Returns null when nothing is accessible.
 */
const facetBaseQuery = (
  query: ProjectFilterOptionsQueryDto,
  facet: FilterFacet,
  frameworkScope: FrameworkKey[] | null
): ProjectFilterOptionsQueryDto | null => {
  const frameworkKey = scopedFrameworkKeys(facet === "frameworkKey" ? undefined : query.frameworkKey, frameworkScope);
  if (frameworkKey != null && frameworkKey.length === 0) return null;
  return { ...query, [facet]: undefined, frameworkKey };
};

const frameworkOptions = async (base: ProjectFilterOptionsQueryDto) => {
  const rows = (await Project.findAll({
    attributes: ["frameworkKey", [fn("COUNT", col("Project.id")), "count"]],
    where: { id: { [Op.in]: projectContextIdsSubquery(base, true) } },
    group: ["Project.framework_key"],
    raw: true
  })) as unknown as FrameworkRow[];
  return rows
    .filter((row): row is FrameworkRow & { frameworkKey: FrameworkKey } => row.frameworkKey != null)
    .map(({ frameworkKey, count }) => ({ value: frameworkKey, count: Number(count) }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.value.localeCompare(b.value)));
};

const countryOptions = async (base: ProjectFilterOptionsQueryDto) => {
  const rows = (await Project.findAll({
    attributes: [
      [literal(COUNTRY_CODE_SQL), "value"],
      [fn("COUNT", col("Project.id")), "count"]
    ],
    where: { id: { [Op.in]: projectContextIdsSubquery(base, true) } },
    group: ["value"],
    raw: true
  })) as unknown as CountryRow[];
  return rows
    .filter((row): row is CountryRow & { value: string } => row.value != null)
    .map(({ value, count }) => ({ value, count: Number(count) }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.value.localeCompare(b.value)));
};

const organisationOptions = async (base: ProjectFilterOptionsQueryDto, search: string | undefined) => {
  const organisationName = containsSearch(search);
  const rows = (await Project.findAll({
    attributes: [
      [col("organisation.uuid"), "uuid"],
      [col("organisation.name"), "name"],
      [fn("COUNT", col("Project.id")), "count"]
    ],
    include: [
      {
        association: "organisation",
        attributes: [],
        required: true,
        ...(organisationName == null ? {} : { where: { name: organisationName } })
      }
    ],
    where: { id: { [Op.in]: projectContextIdsSubquery(base, true) } },
    group: [col("organisation.id")],
    raw: true
  })) as unknown as OrganisationRow[];
  return rows
    .map(({ uuid, name, count }) => ({ uuid, name, count: Number(count) }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : (a.name ?? "").localeCompare(b.name ?? "")));
};

const projectOptions = async (base: ProjectFilterOptionsQueryDto, search: string | undefined) => {
  const projectName = containsSearch(search);
  const where: WhereOptions<Project> = {
    id: { [Op.in]: projectContextIdsSubquery(base, true) },
    ...(projectName == null ? {} : { name: projectName })
  };
  const projects = await Project.findAll({ attributes: ["uuid", "name"], where, order: [["name", "ASC"]] });
  return projects.map(({ uuid, name }) => ({ uuid, name }));
};

@Injectable()
export class ProjectFilterOptionsService {
  /**
   * Options for the polygon review project selector. Each facet is narrowed by every other selection but not by its
   * own, so Framework, Country, Organisation and Project stay interdependent. Organisation and project search only
   * narrow their own option lists.
   */
  async getFilterOptions(query: ProjectFilterOptionsQueryDto, frameworkScope: FrameworkKey[] | null = null) {
    const organisationBase = facetBaseQuery(query, "organisationUuid", frameworkScope);
    const frameworkBase = facetBaseQuery(query, "frameworkKey", frameworkScope);
    const countryBase = facetBaseQuery(query, "country", frameworkScope);
    const projectBase = facetBaseQuery(query, "projectUuid", frameworkScope);

    const [organisations, frameworkKeys, countries, projects] = await Promise.all([
      organisationBase == null ? [] : organisationOptions(organisationBase, query.organisationSearch),
      frameworkBase == null ? [] : frameworkOptions(frameworkBase),
      countryBase == null ? [] : countryOptions(countryBase),
      projectBase == null ? [] : projectOptions(projectBase, query.projectSearch)
    ]);

    return new ProjectFilterOptionsDto({ organisations, frameworkKeys, countries, projects });
  }
}
