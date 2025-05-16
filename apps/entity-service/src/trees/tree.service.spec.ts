/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ReportCountEntity, TreeService } from "./tree.service";
import { Test } from "@nestjs/testing";
import {
  ProjectReport,
  Seeding,
  Site,
  SiteReport,
  TreeSpecies,
  TreeSpeciesResearch
} from "@terramatch-microservices/database/entities";
import { flatten, pick, sumBy, uniq } from "lodash";
import { faker } from "@faker-js/faker";
import {
  NurseryFactory,
  NurseryReportFactory,
  ProjectFactory,
  ProjectReportFactory,
  SeedingFactory,
  SiteFactory,
  SiteReportFactory,
  TaskFactory,
  TreeSpeciesFactory,
  TreeSpeciesResearchFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";

import { PlantingCountDto } from "./dto/planting-count.dto";
import { Op } from "sequelize";

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

  describe("searchScientificName", () => {
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
  });

  describe("getEstablishmentTrees", () => {
    it("should return establishment trees", async () => {
      const tfProject = await ProjectFactory.create({ frameworkKey: "terrafund" });
      const tfProjectReport = await ProjectReportFactory.create({ projectId: tfProject.id, frameworkKey: "terrafund" });
      const site = await SiteFactory.create({ projectId: tfProject.id });
      const siteReport = await SiteReportFactory.create({ siteId: site.id });
      const nursery = await NurseryFactory.create({ projectId: tfProject.id });
      const nurseryReport = await NurseryReportFactory.create({ nurseryId: nursery.id });

      const ppcProject = await ProjectFactory.create({ frameworkKey: "ppc" });
      const ppcProjectReport = await ProjectReportFactory.create({ projectId: ppcProject.id, frameworkKey: "ppc" });

      const tfProjectTrees = (
        await TreeSpeciesFactory.forProjectTreePlanted.createMany(3, { speciesableId: tfProject.id })
      )
        .map(({ name }) => name)
        .sort();
      // hidden trees are ignored
      await TreeSpeciesFactory.forProjectTreePlanted.create({
        speciesableId: tfProject.id,
        hidden: true
      });
      const ppcProjectTrees = (
        await TreeSpeciesFactory.forProjectTreePlanted.createMany(3, { speciesableId: ppcProject.id })
      )
        .map(({ name }) => name)
        .sort();
      const siteTreesPlanted = (await TreeSpeciesFactory.forSiteTreePlanted.createMany(2, { speciesableId: site.id }))
        .map(({ name }) => name)
        .sort();
      await TreeSpeciesFactory.forSiteTreePlanted.create({ speciesableId: site.id, hidden: true });
      const siteNonTrees = (await TreeSpeciesFactory.forSiteNonTree.createMany(3, { speciesableId: site.id }))
        .map(({ name }) => name)
        .sort();
      const siteSeedings = (await SeedingFactory.forSite.createMany(3, { seedableId: site.id }))
        .map(({ name }) => name)
        .sort();
      await SeedingFactory.forSite.create({ seedableId: site.id, hidden: true });
      const nurserySeedlings = (
        await TreeSpeciesFactory.forNurserySeedling.createMany(4, { speciesableId: nursery.id })
      )
        .map(({ name }) => name)
        .sort();
      await TreeSpeciesFactory.forNurserySeedling.create({
        speciesableId: nursery.id,
        hidden: true
      });

      let result = await service.getEstablishmentTrees("projectReports", tfProjectReport.uuid);
      expect(Object.keys(result).length).toBe(1);
      expect(result["tree-planted"].sort()).toEqual(tfProjectTrees);
      result = await service.getEstablishmentTrees("projectReports", ppcProjectReport.uuid);
      expect(Object.keys(result).length).toBe(1);
      // for PPC Project Reports, we fake out the FE by changing the establishment collection from tree-planted to
      // nursery seedling. This is to support the strange situation where project report trees are only ever
      // nursery seedlings in PPC, but the establishment data is always tree-planted.
      expect(result["nursery-seedling"].sort()).toEqual(ppcProjectTrees);
      result = await service.getEstablishmentTrees("sites", site.uuid);
      expect(Object.keys(result)).toEqual(["tree-planted", "seeds"]);
      expect(result["tree-planted"].sort()).toEqual(tfProjectTrees);
      result = await service.getEstablishmentTrees("nurseries", nursery.uuid);
      expect(Object.keys(result).length).toBe(1);
      expect(result["tree-planted"].sort()).toEqual(tfProjectTrees);

      result = await service.getEstablishmentTrees("siteReports", siteReport.uuid);
      expect(Object.keys(result).length).toBe(3);
      expect(result["tree-planted"].sort()).toEqual(uniq([...siteTreesPlanted, ...tfProjectTrees]).sort());
      expect(result["non-tree"].sort()).toEqual(siteNonTrees);
      expect(result["seeds"].sort()).toEqual(siteSeedings);

      result = await service.getEstablishmentTrees("nurseryReports", nurseryReport.uuid);
      expect(Object.keys(result).length).toBe(2);
      expect(result["tree-planted"].sort()).toEqual(tfProjectTrees);
      expect(result["nursery-seedling"].sort()).toEqual(nurserySeedlings);
    });

    it("throws with bad inputs to establishment trees", async () => {
      await expect(service.getEstablishmentTrees("sites", "fakeuuid")).rejects.toThrow(NotFoundException);
      await expect(service.getEstablishmentTrees("siteReports", "fakeuuid")).rejects.toThrow(NotFoundException);
      // @ts-expect-error intentionally sneaking in a bad entity type
      await expect(service.getEstablishmentTrees("nothing-burgers", "fakeuuid")).rejects.toThrow(BadRequestException);
    });
  });

  describe("getPreviousPlanting", () => {
    it("returns previous planting data", async () => {
      const project = await ProjectFactory.create();
      const projectReport1 = await ProjectReportFactory.create({ projectId: project.id });
      const projectReport2 = await ProjectReportFactory.create({
        projectId: project.id,
        dueAt: DateTime.fromJSDate(projectReport1.dueAt!).plus({ months: 3 }).toJSDate()
      });
      const site = await SiteFactory.create({ projectId: project.id });
      const siteReport1 = await SiteReportFactory.create({ siteId: site.id });
      const siteReport2 = await SiteReportFactory.create({
        siteId: site.id,
        dueAt: DateTime.fromJSDate(siteReport1.dueAt!).plus({ months: 3 }).toJSDate()
      });
      const siteReport3 = await SiteReportFactory.create({
        siteId: site.id,
        dueAt: DateTime.fromJSDate(siteReport2.dueAt!).plus({ months: 3 }).toJSDate()
      });
      const nursery = await NurseryFactory.create({ projectId: project.id });
      const nurseryReport1 = await NurseryReportFactory.create({ nurseryId: nursery.id });
      const nurseryReport2 = await NurseryReportFactory.create({
        nurseryId: nursery.id,
        dueAt: DateTime.fromJSDate(nurseryReport1.dueAt!).plus({ months: 3 }).toJSDate()
      });

      const reduceTreeCounts = (counts: Record<string, PlantingCountDto>, tree: TreeSpecies | Seeding) => ({
        ...counts,
        [tree.name!]: {
          taxonId: counts[tree.name!]?.taxonId ?? tree.taxonId ?? undefined,
          amount: (counts[tree.name!]?.amount ?? 0) + (tree.amount ?? 0)
        }
      });
      const projectReportTreesPlanted = await TreeSpeciesFactory.forProjectReportNurserySeedling.createMany(3, {
        speciesableId: projectReport1.id
      });
      projectReportTreesPlanted.push(
        await TreeSpeciesFactory.forProjectReportNurserySeedling.create({
          speciesableId: projectReport1.id,
          taxonId: "wfo-projectreporttree"
        })
      );
      // hidden trees should be ignored
      let hidden = await TreeSpeciesFactory.forProjectReportNurserySeedling.create({
        speciesableId: projectReport1.id,
        hidden: true
      });

      let result = await service.getPreviousPlanting("projectReports", projectReport2.uuid);
      expect(Object.keys(result ?? {})).toMatchObject(["nursery-seedling"]);
      expect(result).toMatchObject({ "nursery-seedling": projectReportTreesPlanted.reduce(reduceTreeCounts, {}) });
      expect(Object.keys(result!["nursery-seedling"])).not.toContain(hidden.name);

      const siteReport1TreesPlanted = await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(3, {
        speciesableId: siteReport1.id
      });
      siteReport1TreesPlanted.push(
        await TreeSpeciesFactory.forSiteReportTreePlanted.create({
          speciesableId: siteReport1.id,
          taxonId: "wfo-sitereporttree"
        })
      );
      // hidden trees should be ignored
      hidden = await TreeSpeciesFactory.forSiteReportTreePlanted.create({
        speciesableId: siteReport1.id,
        hidden: true
      });
      const siteReport2TreesPlanted = await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(3, {
        speciesableId: siteReport2.id
      });
      const siteReport2NonTrees = await TreeSpeciesFactory.forSiteReportNonTree.createMany(2, {
        speciesableId: siteReport2.id
      });
      const siteReport2Seedings = await SeedingFactory.forSiteReport.createMany(2, { seedableId: siteReport2.id });
      await SeedingFactory.forSiteReport.create({ seedableId: siteReport2.id, hidden: true });

      result = await service.getPreviousPlanting("siteReports", siteReport1.uuid);
      expect(result).toMatchObject({});
      result = await service.getPreviousPlanting("siteReports", siteReport2.uuid);
      const siteReport1TreesPlantedReduced = siteReport1TreesPlanted.reduce(reduceTreeCounts, {});
      expect(Object.keys(result ?? {}).sort()).toMatchObject(["seeds", "tree-planted"]);
      expect(result).toMatchObject({ "tree-planted": siteReport1TreesPlantedReduced, seeds: {} });
      expect(Object.keys(result!["tree-planted"])).not.toContain(hidden.name);
      result = await service.getPreviousPlanting("siteReports", siteReport3.uuid);
      expect(Object.keys(result ?? {}).sort()).toMatchObject(["non-tree", "seeds", "tree-planted"]);
      expect(result).toMatchObject({
        "tree-planted": siteReport2TreesPlanted.reduce(reduceTreeCounts, siteReport1TreesPlantedReduced),
        "non-tree": siteReport2NonTrees.reduce(reduceTreeCounts, {}),
        seeds: siteReport2Seedings.reduce(reduceTreeCounts, {})
      });
      expect(Object.keys(result!["tree-planted"])).not.toContain(hidden.name);

      result = await service.getPreviousPlanting("nurseryReports", nurseryReport2.uuid);
      expect(result).toMatchObject({});
      const nurseryReportSeedlings = await TreeSpeciesFactory.forNurseryReportSeedling.createMany(5, {
        speciesableId: nurseryReport1.id
      });
      // hidden trees should be ignored
      hidden = await TreeSpeciesFactory.forNurseryReportSeedling.create({
        speciesableId: nurseryReport1.id,
        hidden: true
      });

      result = await service.getPreviousPlanting("nurseryReports", nurseryReport2.uuid);
      expect(Object.keys(result ?? {})).toMatchObject(["nursery-seedling"]);
      expect(result).toMatchObject({ "nursery-seedling": nurseryReportSeedlings.reduce(reduceTreeCounts, {}) });
      expect(Object.keys(result!["nursery-seedling"])).not.toContain(hidden.name);
    });

    it("handles bad input with undefined or an exception", async () => {
      expect(await service.getPreviousPlanting("sites", "fakeuuid")).toBeUndefined();
      await expect(service.getPreviousPlanting("projectReports", "fakeuuid")).rejects.toThrow(NotFoundException);
      await expect(service.getPreviousPlanting("siteReports", "fakeuuid")).rejects.toThrow(NotFoundException);
      await expect(service.getPreviousPlanting("nurseryReports", "fakeuuid")).rejects.toThrow(NotFoundException);
      // @ts-expect-error intentionally bad report type
      await expect(service.getPreviousPlanting("nothing-burgerReports", "fakeuuid")).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("getAssociatedReportCounts", () => {
    it("throws if the entity type is invalid", async () => {
      await expect(service.getAssociatedReportCounts("siteReports" as ReportCountEntity, "fakeUuid")).rejects.toThrow(
        BadRequestException
      );
    });

    // Tests all entity types of getAssociationReportCounts in a single test because the data requirements
    // are so robust for each one that it makes sense to set them all up at once. Additionally, it helps
    // make sure that each entity type is only returning the data it's really supposed to.
    it("returns associated counts", async () => {
      const tasks = await TaskFactory.createMany(2);
      await ProjectReport.destroy({ where: { taskId: { [Op.in]: tasks.map(({ id }) => id) } } });
      await SiteReport.destroy({ where: { taskId: { [Op.in]: tasks.map(({ id }) => id) } } });

      const project = await ProjectFactory.create();
      const projectReport = await ProjectReportFactory.create({
        projectId: project.id,
        taskId: tasks[0].id,
        status: "approved"
      });

      const sites = await Promise.all(
        Site.APPROVED_STATUSES.map(status => SiteFactory.create({ status, projectId: project.id }))
      );
      const siteReports = await Promise.all(
        flatten(
          sites.map(({ id: siteId }) =>
            tasks.map(task => SiteReportFactory.create({ siteId, taskId: task.id, status: "approved" }))
          )
        )
      );
      const task1SiteReports = siteReports.filter(({ taskId }) => taskId === tasks[0].id);
      const task2SiteReports = siteReports.filter(({ taskId }) => taskId === tasks[1].id);
      const coffeeTrees = await Promise.all(
        [...task1SiteReports, ...task2SiteReports].map(({ id }) =>
          TreeSpeciesFactory.forSiteReportTreePlanted.create({
            speciesableId: id,
            name: "Coffee"
          })
        )
      );
      const seeds = await Promise.all(
        [...task1SiteReports, ...task2SiteReports].map(({ id }) =>
          SeedingFactory.forSiteReport.create({
            seedableId: id,
            name: "Acacia"
          })
        )
      );
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({
        speciesableId: (
          await SiteReportFactory.create({
            siteId: sites[0].id,
            status: "needs-more-information"
          })
        ).id,
        name: "Coffee"
      });
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({
        speciesableId: task1SiteReports[0].id,
        name: "Coffee",
        hidden: true
      });
      const polymorphicId = (plant: TreeSpecies | Seeding) =>
        plant instanceof TreeSpecies ? plant.speciesableId : plant.seedableId;
      const plantsInReports = <P extends TreeSpecies | Seeding>(reports: SiteReport[], plants: P[]) =>
        plants.filter(plant => reports.find(({ id }) => id === polymorphicId(plant)) != null);
      const task1SiteCoffee = sumBy(plantsInReports(task1SiteReports, coffeeTrees), "amount");
      const task2SiteCoffee = sumBy(plantsInReports(task2SiteReports, coffeeTrees), "amount");
      const task1SiteAcacia = sumBy(plantsInReports(task1SiteReports, seeds), "amount");
      const task2SiteAcacia = sumBy(plantsInReports(task2SiteReports, seeds), "amount");
      const site1Reports = [...task1SiteReports, ...task2SiteReports].filter(({ siteId }) => siteId === sites[0].id);
      const site1Coffee = sumBy(plantsInReports(site1Reports, coffeeTrees), "amount");
      const site1Acacia = sumBy(plantsInReports(site1Reports, seeds), "amount");

      const nursery = await NurseryFactory.create({ projectId: project.id });
      const nurseryReports = await NurseryReportFactory.createMany(2, { nurseryId: nursery.id, status: "approved" });
      const nurseryCoffee = sumBy(
        await Promise.all(
          nurseryReports.map(({ id }, index) =>
            TreeSpeciesFactory.forNurseryReportSeedling.create({
              speciesableId: id,
              name: "Coffee",
              taxonId: index === 1 ? "wfo-nurseryreporttree" : undefined
            })
          )
        ),
        "amount"
      );
      const { amount: nurseryAcacia } = await TreeSpeciesFactory.forNurseryReportSeedling.create({
        speciesableId: nurseryReports[0].id,
        name: "Acacia"
      });
      await TreeSpeciesFactory.forNurseryReportSeedling.create({
        speciesableId: (
          await NurseryReportFactory.create({
            nurseryId: nursery.id,
            status: "awaiting-approval"
          })
        ).id,
        name: "Coffee"
      });

      let result = await service.getAssociatedReportCounts("nurseries", nursery.uuid);
      expect(Object.keys(result)).toEqual(["nursery-seedling"]);
      expect(result["nursery-seedling"]).toMatchObject({
        Coffee: { taxonId: "wfo-nurseryreporttree", amount: nurseryCoffee },
        Acacia: { amount: nurseryAcacia }
      });

      result = await service.getAssociatedReportCounts("sites", sites[0].uuid);
      expect(Object.keys(result).length).toBe(2);
      expect(result).toMatchObject({
        "tree-planted": { Coffee: { amount: site1Coffee } },
        seeds: { Acacia: { amount: site1Acacia } }
      });

      result = await service.getAssociatedReportCounts("projects", project.uuid);
      expect(Object.keys(result).length).toBe(2);
      expect(result).toMatchObject({
        "tree-planted": { Coffee: { amount: task1SiteCoffee + task2SiteCoffee } },
        seeds: { Acacia: { amount: task1SiteAcacia + task2SiteAcacia } }
      });

      result = await service.getAssociatedReportCounts("projectReports", projectReport.uuid);
      expect(Object.keys(result).length).toBe(2);
      expect(result).toMatchObject({
        "tree-planted": { Coffee: { amount: task1SiteCoffee } },
        seeds: { Acacia: { amount: task1SiteAcacia } }
      });
    });
  });
});
