import { TreeService } from "./tree.service";
import { Test } from "@nestjs/testing";
import { TreeSpecies, TreeSpeciesResearch } from "@terramatch-microservices/database/entities";
import { pick, uniq } from "lodash";
import { faker } from "@faker-js/faker";
import {
  NurseryFactory,
  NurseryReportFactory,
  ProjectFactory,
  ProjectReportFactory,
  SiteFactory,
  SiteReportFactory,
  TreeSpeciesFactory,
  TreeSpeciesResearchFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";

describe("TreeService", () => {
  let service: TreeService;

  beforeAll(async () => {
    await TreeSpeciesResearch.truncate({ force: true });
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TreeService]
    }).compile();

    service = module.get(TreeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an empty array with no matches", async () => {
    const result = await service.searchScientificNames("test");
    expect(result.length).toBe(0);
  });

  it("should return the matching entries", async () => {
    const tree1 = await TreeSpeciesResearchFactory.create({ scientificName: "Lorem asdfium" });
    const tree2 = await TreeSpeciesResearchFactory.create({ scientificName: "Lorem qasdium" });
    const tree3 = await TreeSpeciesResearchFactory.create({ scientificName: "Ipsum loremium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Alorem ipsium" });
    await TreeSpeciesResearchFactory.create({ scientificName: "Fakem ipslorem" });
    const result = await service.searchScientificNames("lore");
    expect(result.length).toBe(3);
    expect(result).toContainEqual(pick(tree1, ["taxonId", "scientificName"]));
    expect(result).toContainEqual(pick(tree2, ["taxonId", "scientificName"]));
    expect(result).toContainEqual(pick(tree3, ["taxonId", "scientificName"]));
  });

  it("should return 10 entries maximum", async () => {
    for (let ii = 0; ii < 12; ii++) {
      await TreeSpeciesResearchFactory.create({ scientificName: `Tree${faker.word.words()}` });
    }

    const result = await service.searchScientificNames("tree");
    expect(result.length).toBe(10);
  });

  it("should return establishment trees", async () => {
    const project = await ProjectFactory.create();
    const projectReport = await ProjectReportFactory.create({ projectId: project.id });
    const site = await SiteFactory.create({ projectId: project.id });
    const siteReport = await SiteReportFactory.create({ siteId: site.id });
    const nursery = await NurseryFactory.create({ projectId: project.id });
    const nurseryReport = await NurseryReportFactory.create({ nurseryId: nursery.id });

    const projectTrees = (await TreeSpeciesFactory.forProject.createMany(3, { speciesableId: project.id }))
      .map(({ name }) => name)
      .sort();
    const siteTrees = (await TreeSpeciesFactory.forSite.createMany(2, { speciesableId: site.id }))
      .map(({ name }) => name)
      .sort();
    const nurseryTrees = (await TreeSpeciesFactory.forNursery.createMany(4, { speciesableId: nursery.id }))
      .map(({ name }) => name)
      .sort();

    let result = await service.getEstablishmentTrees("project-reports", projectReport.uuid);
    expect(result.sort()).toEqual(projectTrees);
    result = await service.getEstablishmentTrees("sites", site.uuid);
    expect(result.sort()).toEqual(projectTrees);
    result = await service.getEstablishmentTrees("nurseries", nursery.uuid);
    expect(result.sort()).toEqual(projectTrees);

    result = await service.getEstablishmentTrees("site-reports", siteReport.uuid);
    expect(result.sort()).toEqual(uniq([...siteTrees, ...projectTrees]).sort());
    result = await service.getEstablishmentTrees("nursery-reports", nurseryReport.uuid);
    expect(result.sort()).toEqual(uniq([...nurseryTrees, ...projectTrees]).sort());
  });

  it("throws with bad inputs to establishment trees", async () => {
    await expect(service.getEstablishmentTrees("sites", "fakeuuid")).rejects.toThrow(NotFoundException);
    await expect(service.getEstablishmentTrees("site-reports", "fakeuuid")).rejects.toThrow(NotFoundException);
    // @ts-expect-error intentionally sneaking in a bad entity type
    await expect(service.getEstablishmentTrees("nothing-burgers", "fakeuuid")).rejects.toThrow(BadRequestException);
  });

  it("returns previous planting data", async () => {
    const project = await ProjectFactory.create();
    const projectReport1 = await ProjectReportFactory.create({ projectId: project.id });
    const projectReport2 = await ProjectReportFactory.create({
      projectId: project.id,
      dueAt: DateTime.fromJSDate(projectReport1.dueAt).plus({ months: 3 }).toJSDate()
    });
    const site = await SiteFactory.create({ projectId: project.id });
    const siteReport1 = await SiteReportFactory.create({ siteId: site.id });
    const siteReport2 = await SiteReportFactory.create({
      siteId: site.id,
      dueAt: DateTime.fromJSDate(siteReport1.dueAt).plus({ months: 3 }).toJSDate()
    });
    const siteReport3 = await SiteReportFactory.create({
      siteId: site.id,
      dueAt: DateTime.fromJSDate(siteReport2.dueAt).plus({ months: 3 }).toJSDate()
    });
    const nursery = await NurseryFactory.create({ projectId: project.id });
    const nurseryReport1 = await NurseryReportFactory.create({ nurseryId: nursery.id });
    const nurseryReport2 = await NurseryReportFactory.create({
      nurseryId: nursery.id,
      dueAt: DateTime.fromJSDate(nurseryReport1.dueAt).plus({ months: 3 }).toJSDate()
    });

    const reduceTreeCounts = (counts: Record<string, number>, tree: TreeSpecies) => ({
      ...counts,
      [tree.name]: (counts[tree.name] ?? 0) + (tree.amount ?? 0)
    });
    const projectReportTrees = await TreeSpeciesFactory.forProjectReport.createMany(3, {
      speciesableId: projectReport1.id
    });
    let result = await service.getPreviousPlanting("project-reports", projectReport2.uuid);
    expect(result).toMatchObject(projectReportTrees.reduce(reduceTreeCounts, {}));

    const siteReport1Trees = await TreeSpeciesFactory.forSiteReport.createMany(3, { speciesableId: siteReport1.id });
    const siteReport2Trees = await TreeSpeciesFactory.forSiteReport.createMany(3, { speciesableId: siteReport2.id });
    result = await service.getPreviousPlanting("site-reports", siteReport1.uuid);
    expect(result).toMatchObject({});
    result = await service.getPreviousPlanting("site-reports", siteReport2.uuid);
    const siteReport1TreesReduced = siteReport1Trees.reduce(reduceTreeCounts, {});
    expect(result).toMatchObject(siteReport1TreesReduced);
    result = await service.getPreviousPlanting("site-reports", siteReport3.uuid);
    expect(result).toMatchObject(siteReport2Trees.reduce(reduceTreeCounts, siteReport1TreesReduced));

    result = await service.getPreviousPlanting("nursery-reports", nurseryReport2.uuid);
    expect(result).toMatchObject({});
    const nurseryReportTrees = await TreeSpeciesFactory.forNurseryReport.createMany(5, {
      speciesableId: nurseryReport1.id
    });
    result = await service.getPreviousPlanting("nursery-reports", nurseryReport2.uuid);
    expect(result).toMatchObject(nurseryReportTrees.reduce(reduceTreeCounts, {}));
  });

  it("handles bad input to get previous planting with undefined or an exception", async () => {
    expect(await service.getPreviousPlanting("sites", "fakeuuid")).toBeUndefined();
    await expect(service.getPreviousPlanting("project-reports", "fakeuuid")).rejects.toThrow(NotFoundException);
    await expect(service.getPreviousPlanting("site-reports", "fakeuuid")).rejects.toThrow(NotFoundException);
    await expect(service.getPreviousPlanting("nursery-reports", "fakeuuid")).rejects.toThrow(NotFoundException);
    // @ts-expect-error intentionally bad report type
    await expect(service.getPreviousPlanting("nothing-burger-reports", "fakeuuid")).rejects.toThrow(
      BadRequestException
    );
  });
});
