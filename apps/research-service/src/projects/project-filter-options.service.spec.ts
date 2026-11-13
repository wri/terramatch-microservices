import { Test } from "@nestjs/testing";
import { OrganisationFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import type { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { ProjectFilterOptionsService } from "./project-filter-options.service";
import { ProjectFilterOptionsQueryDto } from "./dto/project-filter-options-query.dto";

describe("ProjectFilterOptionsService", () => {
  let service: ProjectFilterOptionsService;

  const getOptions = async (query: ProjectFilterOptionsQueryDto = {}, frameworkScope: FrameworkKey[] | null = null) =>
    (await service.getFilterOptions(query, frameworkScope)) as unknown as {
      organisations: { uuid: string; name: string | null; count: number }[];
      frameworkKeys: { value: FrameworkKey; count: number }[];
      countries: { value: string; count: number }[];
      projects: { uuid: string; name: string | null }[];
    };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProjectFilterOptionsService]
    }).compile();

    service = module.get(ProjectFilterOptionsService);
  });

  it("returns only organisations that own at least one accessible project, with the matching project count", async () => {
    const organisation = await OrganisationFactory.create({ name: "Fixture Org Alpha" });
    const empty = await OrganisationFactory.create({ name: "Fixture Org Empty" });
    await ProjectFactory.createMany(2, { organisationId: organisation.id, frameworkKey: "ppc", level0Project: ["XA"] });

    const { organisations } = await getOptions({ country: ["XA"] });

    expect(organisations).toContainEqual({ uuid: organisation.uuid, name: organisation.name, count: 2 });
    expect(organisations.map(({ uuid }) => uuid)).not.toContain(empty.uuid);
  });

  it("excludes test projects from the options", async () => {
    const organisation = await OrganisationFactory.create({ name: "Fixture Org Test Only" });
    await ProjectFactory.create({ organisationId: organisation.id, isTest: true });

    const options = await getOptions({ organisationUuid: [organisation.uuid] });

    expect(options.organisations.map(({ uuid }) => uuid)).not.toContain(organisation.uuid);
    expect(options.projects).toEqual([]);
  });

  it("limits options to the framework scope of the caller", async () => {
    const organisation = await OrganisationFactory.create({ name: "Fixture Org Scoped" });
    const inScope = await ProjectFactory.create({ organisationId: organisation.id, frameworkKey: "hbf" });
    const outOfScope = await ProjectFactory.create({ organisationId: organisation.id, frameworkKey: "ppc" });

    const { projects, frameworkKeys } = await getOptions({ organisationUuid: [organisation.uuid] }, ["hbf"]);

    expect(projects.map(({ uuid }) => uuid)).toContain(inScope.uuid);
    expect(projects.map(({ uuid }) => uuid)).not.toContain(outOfScope.uuid);
    expect(frameworkKeys).toEqual([{ value: "hbf", count: 1 }]);
  });

  it("returns no options when the requested frameworks are outside the caller's scope", async () => {
    const organisation = await OrganisationFactory.create({ name: "Fixture Org Out Of Scope" });
    await ProjectFactory.create({ organisationId: organisation.id, frameworkKey: "ppc" });

    const options = await getOptions({ frameworkKey: ["ppc"], organisationUuid: [organisation.uuid] }, ["hbf"]);

    expect(options.organisations).toEqual([]);
    expect(options.frameworkKeys).toEqual([]);
    expect(options.countries).toEqual([]);
    expect(options.projects).toEqual([]);
  });

  it("narrows organisations by the selected framework, country and project", async () => {
    const matching = await OrganisationFactory.create({ name: "Fixture Org Narrow Match" });
    const other = await OrganisationFactory.create({ name: "Fixture Org Narrow Other" });
    const selected = await ProjectFactory.create({
      organisationId: matching.id,
      frameworkKey: "epa-ghana-pilot",
      level0Project: ["XB"]
    });
    await ProjectFactory.create({ organisationId: other.id, frameworkKey: "ppc", level0Project: ["XC"] });

    expect((await getOptions({ frameworkKey: ["epa-ghana-pilot"] })).organisations.map(({ uuid }) => uuid)).toContain(
      matching.uuid
    );
    expect(
      (await getOptions({ frameworkKey: ["epa-ghana-pilot"] })).organisations.map(({ uuid }) => uuid)
    ).not.toContain(other.uuid);
    expect((await getOptions({ country: ["XC"] })).organisations.map(({ uuid }) => uuid)).toContain(other.uuid);
    expect((await getOptions({ country: ["XC"] })).organisations.map(({ uuid }) => uuid)).not.toContain(matching.uuid);
    expect((await getOptions({ projectUuid: [selected.uuid] })).organisations.map(({ uuid }) => uuid)).toEqual([
      matching.uuid
    ]);
  });

  it("narrows framework, country and project options by the selected organisation", async () => {
    const organisation = await OrganisationFactory.create({ name: "Fixture Org Facets" });
    const alpha = await ProjectFactory.create({
      organisationId: organisation.id,
      frameworkKey: "ppc",
      level0Project: ["XD"],
      name: "Fixture Facet Alpha"
    });
    const beta = await ProjectFactory.create({
      organisationId: organisation.id,
      frameworkKey: "hbf",
      level0Project: ["XD"],
      name: "Fixture Facet Beta"
    });
    await ProjectFactory.create({ frameworkKey: "hbf", level0Project: ["XE"], name: "Fixture Facet Elsewhere" });

    const options = await getOptions({ organisationUuid: [organisation.uuid] });

    expect(options.frameworkKeys).toEqual(
      expect.arrayContaining([
        { value: "ppc", count: 1 },
        { value: "hbf", count: 1 }
      ])
    );
    expect(options.countries).toEqual([{ value: "XD", count: 2 }]);
    expect(options.projects.map(({ uuid }) => uuid).sort()).toEqual([alpha.uuid, beta.uuid].sort());
  });

  it("keeps each facet's own selection out of its own options", async () => {
    const organisation = await OrganisationFactory.create({ name: "Fixture Org Own Facet" });
    await ProjectFactory.create({ organisationId: organisation.id, frameworkKey: "ppc", level0Project: ["XF"] });
    await ProjectFactory.create({ organisationId: organisation.id, frameworkKey: "hbf", level0Project: ["XF"] });

    const { frameworkKeys } = await getOptions({ frameworkKey: ["ppc"], organisationUuid: [organisation.uuid] });

    expect(frameworkKeys.map(({ value }) => value).sort()).toEqual(["hbf", "ppc"]);
  });

  it("searches organisation names case-insensitively and partially, narrowing only the organisation options", async () => {
    const organisation = await OrganisationFactory.create({ name: "Quokka Restoration Trust" });
    const project = await ProjectFactory.create({ organisationId: organisation.id, name: "Quokka Project Fixture" });

    const { organisations, projects } = await getOptions({ organisationSearch: "quokka rest" });

    expect(organisations.map(({ uuid }) => uuid)).toContain(organisation.uuid);
    expect(projects.map(({ uuid }) => uuid)).toContain(project.uuid);
  });

  it("searches project names case-insensitively and partially, narrowing only the project options", async () => {
    const organisation = await OrganisationFactory.create({ name: "Search Scope Org" });
    const match = await ProjectFactory.create({ organisationId: organisation.id, name: "Wombat Canyon Fixture" });
    const miss = await ProjectFactory.create({ organisationId: organisation.id, name: "Platypus Fixture" });

    const searched = await getOptions({ organisationUuid: [organisation.uuid], projectSearch: "WOMBAT" });
    const unsearched = await getOptions({ organisationUuid: [organisation.uuid] });

    expect(searched.projects.map(({ uuid }) => uuid)).toEqual([match.uuid]);
    expect(searched.projects.map(({ uuid }) => uuid)).not.toContain(miss.uuid);
    expect(searched.organisations).toEqual(unsearched.organisations);
  });

  it("treats LIKE wildcards in the search as literal characters", async () => {
    const organisation = await OrganisationFactory.create({ name: "Percent Literal Org" });
    await ProjectFactory.create({ organisationId: organisation.id, name: "Plain Name Fixture" });

    const { projects } = await getOptions({ organisationUuid: [organisation.uuid], projectSearch: "%" });

    expect(projects).toEqual([]);
  });
});
