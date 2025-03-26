import {
  Demographic,
  Framework,
  Project,
  ProjectReport,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { ProjectProcessor } from "./project.processor";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities.service";
import {
  ApplicationFactory,
  DemographicEntryFactory,
  DemographicFactory,
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  SeedingFactory,
  SiteFactory,
  SitePolygonFactory,
  SiteReportFactory,
  TreeSpeciesFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { createMock } from "@golevelup/ts-jest";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { flatten, reverse, sortBy, sum, sumBy } from "lodash";
import { DateTime } from "luxon";
import { faker } from "@faker-js/faker";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ProjectFullDto, ProjectLightDto } from "../dto/project.dto";
import { BadRequestException } from "@nestjs/common";
import { FULL_TIME, PART_TIME } from "@terramatch-microservices/database/constants/demographic-collections";

describe("ProjectProcessor", () => {
  let processor: ProjectProcessor;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Project.truncate();

    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("projects") as ProjectProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("findMany", () => {
    async function expectProjects(
      expected: Project[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = ["projects-read"],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto, userId, permissions);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("returns my projects", async () => {
      const projects = await ProjectFactory.createMany(3);
      for (const { id } of projects) {
        await ProjectUserFactory.create({ userId, projectId: id });
      }
      await ProjectFactory.createMany(5);

      await expectProjects(projects, {}, { permissions: ["manage-own"] });
    });

    it("returns managed projects", async () => {
      const projects = await ProjectFactory.createMany(3);
      for (const { id } of projects) {
        await ProjectUserFactory.create({ userId, projectId: id, isMonitoring: false, isManaging: true });
      }
      await ProjectFactory.createMany(5);

      await expectProjects(projects, {}, { permissions: ["projects-manage"] });
    });

    it("returns framework projects", async () => {
      const projects = await ProjectFactory.createMany(3, { frameworkKey: "hbf" });
      await ProjectFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await ProjectFactory.createMany(3, { frameworkKey: "terrafund" })) {
        projects.push(p);
      }

      await expectProjects(projects, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("filters", async () => {
      const us = await ProjectFactory.create({
        country: "US",
        status: "approved",
        updateRequestStatus: "draft"
      });
      const mx = await ProjectFactory.create({
        country: "MX",
        status: "started",
        updateRequestStatus: "awaiting-approval"
      });
      const ca = await ProjectFactory.create({
        country: "CA",
        status: "approved",
        updateRequestStatus: "awaiting-approval"
      });

      await expectProjects([mx], { country: "MX" });
      await expectProjects([us, ca], { status: "approved" });
      await expectProjects([mx, ca], { updateRequestStatus: "awaiting-approval" });
    });

    it("searches", async () => {
      const p1 = await ProjectFactory.create({ name: "Foo Bar" });
      const p2 = await ProjectFactory.create({ name: "Baz Foo" });
      await ProjectFactory.createMany(3);

      await expectProjects([p1, p2], { search: "foo" });
    });

    it("sorts", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const org3 = await OrganisationFactory.create({ name: "C Org" });
      const projects = [
        await ProjectFactory.create({
          name: "A Project",
          plantingStartDate: DateTime.now().minus({ days: 1 }).toJSDate(),
          organisationId: org2.id
        })
      ];
      projects.push(
        await ProjectFactory.create({
          name: "Z Project",
          plantingStartDate: DateTime.now().minus({ days: 10 }).toJSDate(),
          organisationId: org3.id
        })
      );
      projects.push(
        await ProjectFactory.create({
          name: "M Project",
          plantingStartDate: DateTime.now().minus({ days: 5 }).toJSDate(),
          organisationId: org1.id
        })
      );

      for (const p of projects) {
        // required to get the organisationName sort on the expected end to work.
        p.organisation = await p.$get("organisation");
      }

      await expectProjects(projects, { sort: { field: "name" } }, { sortField: "name" });
      await expectProjects(projects, { sort: { field: "name", direction: "ASC" } }, { sortField: "name" });
      await expectProjects(
        projects,
        { sort: { field: "name", direction: "DESC" } },
        { sortField: "name", sortUp: false }
      );
      await expectProjects(projects, { sort: { field: "plantingStartDate" } }, { sortField: "plantingStartDate" });
      await expectProjects(
        projects,
        { sort: { field: "plantingStartDate", direction: "DESC" } },
        { sortField: "plantingStartDate", sortUp: false }
      );
      await expectProjects(projects, { sort: { field: "organisationName" } }, { sortField: "organisationName" });
      await expectProjects(
        projects,
        { sort: { field: "organisationName", direction: "DESC" } },
        { sortField: "organisationName", sortUp: false }
      );

      await expect(
        processor.findMany({ sort: { field: "uuid" } } as EntityQueryDto, userId, ["projects-read"])
      ).rejects.toThrow(BadRequestException);
    });

    it("paginates", async () => {
      const projects = sortBy(await ProjectFactory.createMany(25), "id");
      await expectProjects(projects.slice(0, 10), { page: { size: 10 } }, { total: projects.length });
      await expectProjects(projects.slice(10, 20), { page: { size: 10, number: 2 } }, { total: projects.length });
      await expectProjects(projects.slice(20), { page: { size: 10, number: 3 } }, { total: projects.length });
    });
  });

  describe("findOne", () => {
    it("returns the requested project", async () => {
      const project = await ProjectFactory.create({});
      const result = await processor.findOne(project.uuid);
      expect(result.id).toBe(project.id);
    });
  });

  describe("DTOs", () => {
    it("includes calculated fields in ProjectLightDto", async () => {
      const org = await OrganisationFactory.create();
      const { uuid } = await ProjectFactory.create({
        organisationId: org.id,
        frameworkKey: "foofund" as FrameworkKey
      });

      const { models } = await processor.findMany({} as EntityQueryDto, userId, ["projects-read"]);
      const document = buildJsonApi(ProjectLightDto, { forceDataArray: true });
      await processor.addLightDto(document, models[0]);
      const attributes = document.serialize().data[0].attributes as ProjectLightDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: true,
        organisationName: org.name
      });
    });

    it("includes calculated fields in ProjectFullDto", async () => {
      const org = await OrganisationFactory.create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      const { id: projectId, uuid } = await ProjectFactory.create({
        organisationId: org.id,
        frameworkKey: "barfund" as FrameworkKey,
        applicationId: application.id
      });
      const approvedSites = [await SiteFactory.create({ projectId, status: "approved" })];
      approvedSites.push(await SiteFactory.create({ projectId, status: "restoration-in-progress" }));
      await SiteFactory.create({ projectId, status: "started" });
      const approvedNurseries = await NurseryFactory.createMany(3, { projectId, status: "approved" });
      await NurseryFactory.create({ projectId, status: "needs-more-information" });

      const approvedProjectReports = [
        await ProjectReportFactory.create({ projectId, status: "approved", dueAt: new Date() })
      ];
      approvedProjectReports.push(
        await ProjectReportFactory.create({
          projectId,
          status: "approved",
          dueAt: DateTime.fromJSDate(new Date(Demographic.DEMOGRAPHIC_COUNT_CUTOFF)).minus({ months: 1 }).toJSDate()
        })
      );
      const approvedSiteReports = [
        await SiteReportFactory.create({ siteId: approvedSites[0].id, status: "approved", dueAt: new Date() })
      ];
      approvedSiteReports.push(
        await SiteReportFactory.create({ siteId: approvedSites[1].id, status: "approved", dueAt: new Date() })
      );
      approvedSiteReports.push(
        await SiteReportFactory.create({
          siteId: approvedSites[1].id,
          status: "approved",
          dueAt: DateTime.fromJSDate(new Date(Demographic.DEMOGRAPHIC_COUNT_CUTOFF)).minus({ months: 1 }).toJSDate()
        })
      );

      const treeCounts = approvedSiteReports.map(({ numTreesRegenerating }) => numTreesRegenerating);
      const treeSpecies = flatten(
        await Promise.all(
          approvedSiteReports.map(({ id }) =>
            TreeSpeciesFactory.forSiteReportTreePlanted.createMany(faker.number.int({ min: 1, max: 10 }), {
              speciesableId: id
            })
          )
        )
      );
      await TreeSpeciesFactory.forSiteReportNonTree.createMany(5, { speciesableId: approvedSiteReports[0].id });
      await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(2, {
        speciesableId: approvedSiteReports[0].id,
        hidden: true
      });
      const seedings = flatten(
        await Promise.all(
          approvedSiteReports.map(({ id }) =>
            SeedingFactory.forSiteReport.createMany(faker.number.int({ min: 1, max: 10 }), { seedableId: id })
          )
        )
      );
      await SeedingFactory.forSiteReport.createMany(2, { seedableId: approvedSiteReports[0].id, hidden: true });
      const regeneratedTreesCount = sum(treeCounts);
      const treesPlantedCount = sumBy(treeSpecies, "amount");
      const seedsPlantedCount = sumBy(seedings, "amount");

      // incomplete reports
      await ProjectReportFactory.create({ projectId, status: "needs-more-information" });
      await SiteReportFactory.create({ siteId: approvedSites[0].id, status: "due" });
      await NurseryReportFactory.create({ nurseryId: approvedNurseries[1].id, status: "started" });

      const sitePolygons = flatten(
        await Promise.all(
          approvedSites.map(({ uuid }) =>
            SitePolygonFactory.create({ siteUuid: uuid, status: "approved", isActive: true })
          )
        )
      );

      // Because of the "demographics cutoff" logic, we have to carefully construct a set of
      // workdays that are on site and project reports, with some that are from before the cutoff,
      // and some that are after.
      const siteDemographicAfterCutoff = await DemographicFactory.forSiteReportWorkday.create({
        demographicalId: approvedSiteReports[0].id
      });
      const siteDemographicBeforeCutoff = await DemographicFactory.forSiteReportWorkday.create({
        demographicalId: approvedSiteReports[2].id
      });
      const projectDemographicAfterCutoff = await DemographicFactory.forProjectReportWorkday.create({
        demographicalId: approvedProjectReports[0].id
      });
      const projectDemographicBeforeCutoff = await DemographicFactory.forProjectReportWorkday.create({
        demographicalId: approvedProjectReports[1].id
      });
      let workdayCountAfterCutoff = (
        await DemographicEntryFactory.create({ demographicId: siteDemographicAfterCutoff.id, type: "gender" })
      ).amount;
      workdayCountAfterCutoff += (
        await DemographicEntryFactory.create({ demographicId: projectDemographicAfterCutoff.id, type: "gender" })
      ).amount;
      let workdayCountBeforeCutoff = (
        await DemographicEntryFactory.create({ demographicId: siteDemographicBeforeCutoff.id, type: "gender" })
      ).amount;
      workdayCountBeforeCutoff += (
        await DemographicEntryFactory.create({ demographicId: projectDemographicBeforeCutoff.id, type: "gender" })
      ).amount;
      await DemographicEntryFactory.create({ demographicId: siteDemographicAfterCutoff.id, type: "age" });
      await DemographicEntryFactory.create({ demographicId: projectDemographicBeforeCutoff.id, type: "age" });
      const selfReportedWorkdayCount = (reports: (SiteReport | ProjectReport)[]) =>
        sumBy(reports, "workdaysPaid") + sumBy(reports, "workdaysVolunteer");

      const totalJobsCreated = sum(
        await Promise.all(
          approvedProjectReports.map(async ({ id }) => {
            const fullTime = await DemographicFactory.forProjectReportJobs.create({
              demographicalId: id,
              collection: FULL_TIME
            });
            const partTime = await DemographicFactory.forProjectReportJobs.create({
              demographicalId: id,
              collection: PART_TIME
            });
            const { amount: fullTimeAmount } = await DemographicEntryFactory.create({
              demographicId: fullTime.id,
              type: "gender"
            });
            const { amount: partTimeAmount } = await DemographicEntryFactory.create({
              demographicId: partTime.id,
              type: "gender"
            });
            return fullTimeAmount + partTimeAmount;
          })
        )
      );

      const project = await processor.findOne(uuid);
      const document = buildJsonApi(ProjectFullDto, { forceDataArray: true });
      await processor.addFullDto(document, project);
      const attributes = document.serialize().data[0].attributes as ProjectFullDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: false,
        organisationName: org.name,
        totalSites: approvedSites.length,
        totalNurseries: approvedNurseries.length,
        totalOverdueReports: 3,
        totalProjectReports: 3,
        assistedNaturalRegenerationList: [
          {
            name: approvedSites[0].name,
            treeCount: treeCounts[0]
          },
          {
            name: approvedSites[1].name,
            treeCount: sum(treeCounts.slice(1))
          }
        ],
        regeneratedTreesCount,
        treesPlantedCount,
        seedsPlantedCount,
        treesRestoredPpc:
          regeneratedTreesCount +
          (treesPlantedCount * ((project.survivalRate ?? 0) / 100) +
            (seedsPlantedCount * (project.directSeedingSurvivalRate ?? 0)) / 100),
        totalHectaresRestoredSum: sumBy(sitePolygons, "calcArea"),
        workdayCount: workdayCountAfterCutoff + workdayCountBeforeCutoff,
        selfReportedWorkdayCount: selfReportedWorkdayCount([...approvedSiteReports, ...approvedProjectReports]),
        combinedWorkdayCount:
          workdayCountAfterCutoff + selfReportedWorkdayCount([approvedSiteReports[2], approvedProjectReports[1]]),
        totalJobsCreated,
        application: {
          uuid: application.uuid,
          fundingProgrammeName: (await application.$get("fundingProgramme")).name,
          projectPitchUuid: null
        }
      });
    });
  });
});
