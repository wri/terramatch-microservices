/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Tracking,
  TrackingEntry,
  Project,
  ProjectReport,
  ProjectUser,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { ProjectProcessor } from "./project.processor";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities.service";
import {
  ApplicationFactory,
  TrackingEntryFactory,
  TrackingFactory,
  EntityFormFactory,
  FormSubmissionFactory,
  MediaFactory,
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectPitchFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  SeedingFactory,
  SiteFactory,
  SitePolygonFactory,
  SiteReportFactory,
  TreeSpeciesFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Dictionary, flatten, reverse, sortBy, sum, sumBy } from "lodash";
import { DateTime } from "luxon";
import { faker } from "@faker-js/faker";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { FULL_TIME, PART_TIME } from "@terramatch-microservices/database/constants/demographic-collections";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectLightDto } from "../dto/project.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { EntityProcessor } from "./entity-processor";

describe("ProjectProcessor", () => {
  let processor: ProjectProcessor;
  let mediaService: DeepMocked<MediaService>;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Project.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
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
      policyService.getPermissions.mockResolvedValue(permissions);
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto);
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

    it("filters by landscape, cohort and organisationType", async () => {
      const orgForProfit = await OrganisationFactory.create({ type: "for-profit-organisation" });
      const orgNonProfit = await OrganisationFactory.create({ type: "non-profit-organisation" });
      const orgOther = await OrganisationFactory.create({ type: "other-organisation" });

      const project1 = await ProjectFactory.create({
        landscape: "Greater Rift Valley of Kenya",
        cohort: ["terrafund"],
        organisationId: orgForProfit.id
      });
      const project2 = await ProjectFactory.create({
        landscape: "Ghana Cocoa Belt",
        cohort: ["terrafund"],
        organisationId: orgNonProfit.id
      });
      const project3 = await ProjectFactory.create({
        landscape: "Greater Rift Valley of Kenya",
        cohort: ["terrafund-landscapes"],
        organisationId: orgOther.id
      });
      const project4 = await ProjectFactory.create({
        landscape: "Lake Kivu & Rusizi River Basin",
        cohort: ["enterprise"],
        organisationId: orgForProfit.id
      });

      for (const p of [project1, project2, project3, project4]) {
        p.organisation = await p.$get("organisation");
      }

      await expectProjects([project1, project3], { landscape: ["grv"] });
      await expectProjects([project1, project2], { cohort: ["terrafund"] });
      await expectProjects([project1, project4], { organisationType: ["for-profit-organisation"] });
      await expectProjects([project2], { organisationType: ["non-profit-organisation"] });
      await expectProjects([project1], {
        landscape: ["grv"],
        cohort: ["terrafund"],
        organisationType: ["for-profit-organisation"]
      });
      await expectProjects([project1, project3, project4], {
        landscape: ["grv", "ikr"]
      });
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

      policyService.getPermissions.mockResolvedValue(["projects-read"]);
      await expect(processor.findMany({ sort: { field: "uuid" } })).rejects.toThrow(BadRequestException);
    });

    it("paginates", async () => {
      const projects = sortBy(await ProjectFactory.createMany(25), "id");
      await expectProjects(projects.slice(0, 10), { page: { size: 10 } }, { total: projects.length });
      await expectProjects(projects.slice(10, 20), { page: { size: 10, number: 2 } }, { total: projects.length });
      await expectProjects(projects.slice(20), { page: { size: 10, number: 3 } }, { total: projects.length });
    });

    it("should throw an error if the sort field is not recognized", async () => {
      policyService.getPermissions.mockResolvedValue([]);
      await expect(processor.findMany({ sort: { field: "foo" } })).rejects.toThrow(BadRequestException);
    });

    describe("processSideload", () => {
      it("throws if the sideloads includes something unsupported", async () => {
        const project = await ProjectFactory.create();
        policyService.getPermissions.mockResolvedValue(["projects-read"]);
        const document = buildJsonApi(ProjectLightDto);
        await processor.loadAssociationData([project.id]);
        await expect(
          processor.addIndex(document, { sideloads: [{ entity: "siteReports", pageSize: 5 }] })
        ).rejects.toThrow(BadRequestException);
      });

      it("includes sideloaded sites and nurseries", async () => {
        const { id: projectId } = await ProjectFactory.create({ frameworkKey: "terrafund" });
        await SiteFactory.createMany(12, { projectId, frameworkKey: "terrafund" });
        await NurseryFactory.createMany(3, { projectId, frameworkKey: "terrafund" });
        policyService.getPermissions.mockResolvedValue(["framework-terrafund"]);
        const document = buildJsonApi(ProjectLightDto);
        await processor.addIndex(document, {
          sideloads: [
            { entity: "sites", pageSize: 5 },
            { entity: "nurseries", pageSize: 5 }
          ]
        });

        const result = document.serialize();
        expect(result.included?.length).toBe(8);
        expect(result.included!.filter(({ type }) => type === "sites").length).toBe(5);
        expect(result.included!.filter(({ type }) => type === "nurseries").length).toBe(3);
        expect(result.meta.indices?.length).toBe(3);
        expect(result.meta.indices!.find(({ resource }) => resource === "sites")?.total).toBe(12);
      });
    });
  });

  describe("findOne", () => {
    it("returns the requested project", async () => {
      const project = await ProjectFactory.create({});
      const result = await processor.findOne(project.uuid);
      expect(result!.id).toBe(project.id);
    });
  });

  describe("update", () => {
    it("can update the isTest flag", async () => {
      const project = await ProjectFactory.create({ isTest: false });
      policyService.getPermissions.mockResolvedValue(["projects-read"]);
      await expect(processor.update(project, { isTest: false })).rejects.toThrow(UnauthorizedException);
      expect(project.isTest).toBe(false);
      await processor.update(project, {});
      expect(project.isTest).toBe(false);

      policyService.getPermissions.mockResolvedValue([`framework-${project.frameworkKey}`]);
      await processor.update(project, { isTest: true });
      expect(project.isTest).toBe(true);
    });

    it("should call super.update", async () => {
      const project = await ProjectFactory.create();
      const spy = jest.spyOn(EntityProcessor.prototype, "update");
      const update = { feedback: "foo" };
      await processor.update(project, update);
      expect(spy).toHaveBeenCalledWith(project, update);
    });
  });

  describe("DTOs", () => {
    it("includes calculated fields in ProjectLightDto", async () => {
      const org = await OrganisationFactory.create();
      const { uuid } = await ProjectFactory.create({
        organisationId: org.id,
        frameworkKey: "foofund" as FrameworkKey
      });

      policyService.getPermissions.mockResolvedValue(["projects-read"]);
      const { models } = await processor.findMany({});
      const { id, dto } = await processor.getLightDto(models[0], new ProjectLightDto());
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: true,
        organisationName: org.name
      });
    });

    describe("plantingStatus", () => {
      it("uses plantingStatus from the most recent approved project report (by dueAt)", async () => {
        const { id: projectId, uuid } = await ProjectFactory.create();

        await ProjectReportFactory.create({
          projectId,
          status: "approved",
          dueAt: DateTime.now().minus({ months: 3 }).toJSDate(),
          plantingStatus: "not-started"
        });
        await ProjectReportFactory.create({
          projectId,
          status: "approved",
          dueAt: DateTime.now().minus({ months: 1 }).toJSDate(),
          plantingStatus: "in-progress"
        });
        await ProjectReportFactory.create({
          projectId,
          status: "approved",
          dueAt: DateTime.now().minus({ months: 2 }).toJSDate(),
          plantingStatus: "completed"
        });
        await ProjectReportFactory.create({
          projectId,
          status: "started",
          dueAt: DateTime.now().toJSDate(),
          plantingStatus: "replacement-planting"
        });

        const project = await processor.findOne(uuid);
        const { dto: fullDto } = await processor.getFullDto(project!);
        expect(fullDto.plantingStatus).toBe("in-progress");

        policyService.getPermissions.mockResolvedValue(["projects-read"]);
        const { models } = await processor.findMany({});
        const { dto: lightDto } = await processor.getLightDto(models[0], new ProjectLightDto());
        expect(lightDto.plantingStatus).toBe("in-progress");
      });

      it("returns null when no approved reports and project has no plantingStatus", async () => {
        const { uuid } = await ProjectFactory.create();

        const project = await processor.findOne(uuid);
        const { dto: fullDto } = await processor.getFullDto(project!);
        expect(fullDto.plantingStatus).toBeNull();

        policyService.getPermissions.mockResolvedValue(["projects-read"]);
        const { models } = await processor.findMany({});
        const { dto: lightDto } = await processor.getLightDto(models[0], new ProjectLightDto());
        expect(lightDto.plantingStatus).toBeNull();
      });
    });

    it("includes calculated fields in ProjectFullDto", async () => {
      const org = await OrganisationFactory.create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      let project = await ProjectFactory.create({
        organisationId: org.id,
        frameworkKey: "barfund" as FrameworkKey,
        applicationId: application.id
      });
      const { id: projectId, uuid } = project;
      const approvedSites = [await SiteFactory.create({ projectId, status: "approved" })];
      approvedSites.push(await SiteFactory.create({ projectId, status: "approved" }));
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
          dueAt: DateTime.fromJSDate(new Date(Tracking.DEMOGRAPHIC_COUNT_CUTOFF)).minus({ months: 1 }).toJSDate()
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
          dueAt: DateTime.fromJSDate(new Date(Tracking.DEMOGRAPHIC_COUNT_CUTOFF)).minus({ months: 1 }).toJSDate()
        })
      );

      const treeCounts = approvedSiteReports.map(({ numTreesRegenerating }) => numTreesRegenerating);
      const treeSpecies = flatten(
        await Promise.all(
          approvedSiteReports.map(report =>
            TreeSpeciesFactory.siteReportTreePlanted(report).createMany(faker.number.int({ min: 1, max: 10 }))
          )
        )
      );
      await TreeSpeciesFactory.siteReportNonTree(approvedSiteReports[0]).createMany(5);
      await TreeSpeciesFactory.siteReportTreePlanted(approvedSiteReports[0]).createMany(2, { hidden: true });
      const seedings = flatten(
        await Promise.all(
          approvedSiteReports.map(report =>
            SeedingFactory.siteReport(report).createMany(faker.number.int({ min: 1, max: 10 }))
          )
        )
      );
      await SeedingFactory.siteReport(approvedSiteReports[0]).createMany(2, { hidden: true });
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
      const siteDemographicAfterCutoff = await TrackingFactory.siteReportWorkday(approvedSiteReports[0]).create();
      const siteDemographicBeforeCutoff = await TrackingFactory.siteReportWorkday(approvedSiteReports[2]).create();
      const projectDemographicAfterCutoff = await TrackingFactory.projectReportWorkday(
        approvedProjectReports[0]
      ).create();
      const projectDemographicBeforeCutoff = await TrackingFactory.projectReportWorkday(
        approvedProjectReports[1]
      ).create();
      let workdayCountAfterCutoff = (await TrackingEntryFactory.gender(siteDemographicAfterCutoff).create()).amount;
      workdayCountAfterCutoff += (await TrackingEntryFactory.gender(projectDemographicAfterCutoff).create()).amount;
      let workdayCountBeforeCutoff = (await TrackingEntryFactory.gender(siteDemographicBeforeCutoff).create()).amount;
      workdayCountBeforeCutoff += (await TrackingEntryFactory.gender(projectDemographicBeforeCutoff).create()).amount;
      await TrackingEntryFactory.age(siteDemographicAfterCutoff).create();
      await TrackingEntryFactory.age(projectDemographicBeforeCutoff).create();
      const selfReportedWorkdayCount = (reports: (SiteReport | ProjectReport)[]) =>
        sumBy(reports, "workdaysPaid") + sumBy(reports, "workdaysVolunteer");

      const totalJobsCreated = sum(
        await Promise.all(
          approvedProjectReports.map(async report => {
            const fullTime = await TrackingFactory.projectReportJobs(report).create({ collection: FULL_TIME });
            const partTime = await TrackingFactory.projectReportJobs(report).create({ collection: PART_TIME });
            const { amount: fullTimeAmount } = await TrackingEntryFactory.gender(fullTime).create();
            const { amount: partTimeAmount } = await TrackingEntryFactory.gender(partTime).create();
            return fullTimeAmount + partTimeAmount;
          })
        )
      );

      const hectaresGoal = await TrackingFactory.projectHectaresGoal(project).create();
      const hectaresEntries = await Promise.all([
        TrackingEntryFactory.years(hectaresGoal, "1-year").create(),
        TrackingEntryFactory.years(hectaresGoal, "2-year").create(),
        TrackingEntryFactory.strategy(hectaresGoal, "anr").create()
      ]);
      const totalHectaresRestoredGoal = sumBy(
        hectaresEntries.filter(({ type }) => type === "years"),
        "amount"
      );

      const treesGoal = await TrackingFactory.projectTreesGoal(project).create();
      const treeEntries = await Promise.all([
        TrackingEntryFactory.years(treesGoal, "1-year").create(),
        TrackingEntryFactory.years(treesGoal, "2-year").create(),
        TrackingEntryFactory.strategy(treesGoal, "anr").create(),
        TrackingEntryFactory.strategy(treesGoal, "direct-seeding").create(),
        TrackingEntryFactory.strategy(treesGoal, "tree-planting").create()
      ]);
      const treesGrownGoal = sumBy(
        treeEntries.filter(
          ({ type, subtype }) =>
            type === "years" || (type === "strategy" && ["anr", "direct-seeding"].includes(subtype ?? ""))
        ),
        "amount"
      );

      project = (await processor.findOne(uuid)) as Project;
      const { id, dto } = await processor.getFullDto(project);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
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
          (treesPlantedCount * ((project?.survivalRate ?? 0) / 100) +
            (seedsPlantedCount * (project?.directSeedingSurvivalRate ?? 0)) / 100),
        totalHectaresRestoredSum: sumBy(sitePolygons, "calcArea"),
        workdayCount: workdayCountAfterCutoff + workdayCountBeforeCutoff,
        selfReportedWorkdayCount: selfReportedWorkdayCount([...approvedSiteReports, ...approvedProjectReports]),
        combinedWorkdayCount:
          workdayCountAfterCutoff + selfReportedWorkdayCount([approvedSiteReports[2], approvedProjectReports[1]]),
        totalJobsCreated,
        application: {
          uuid: application.uuid,
          fundingProgrammeName: (await application.$get("fundingProgramme"))?.name,
          projectPitchUuid: null
        },
        totalHectaresRestoredGoal,
        treesGrownGoal
      });
    });
  });

  describe("create", () => {
    it("throws if a valid form is not provided", async () => {
      await expect(processor.create({ formUuid: "fake-uuid" })).rejects.toThrow(
        "Invalid form for project creation: fake-uuid"
      );

      let form = await EntityFormFactory.site().create({ frameworkKey: "terrafund" });
      await expect(processor.create({ formUuid: form.uuid })).rejects.toThrow(
        `Invalid form for project creation: ${form.uuid}`
      );

      form = await EntityFormFactory.project().create({ frameworkKey: null });
      await expect(processor.create({ formUuid: form.uuid })).rejects.toThrow(
        `Invalid form for project creation: ${form.uuid}`
      );
    });

    it("throws if an invalid application UUID is provided", async () => {
      const form = await EntityFormFactory.project().create();
      await expect(processor.create({ formUuid: form.uuid, applicationUuid: "fake-uuid" })).rejects.toThrow(
        "Invalid application for project creation: fake-uuid"
      );
    });

    it("throws if the user doesn't have a valid org", async () => {
      const form = await EntityFormFactory.project().create();
      await expect(processor.create({ formUuid: form.uuid })).rejects.toThrow(
        "Current user does not have an organisation associated"
      );
    });

    it("throws if the application doesn't have a valid org", async () => {
      const form = await EntityFormFactory.project().create();
      const application = await ApplicationFactory.create({ organisationUuid: null });
      await expect(processor.create({ formUuid: form.uuid, applicationUuid: application.uuid })).rejects.toThrow(
        `Invalid application for project creation: ${application.uuid}`
      );
    });

    it("creates a test project if the org is a test org", async () => {
      const org = await OrganisationFactory.create({ isTest: true });
      const user = await UserFactory.create({ organisationId: org.id });
      (policyService as unknown as Dictionary<unknown>).userId = user.id;
      const form = await EntityFormFactory.project().create();
      const project = await processor.create({ formUuid: form.uuid });
      expect(project.isTest).toBe(true);
    });

    it("creates blank project if there is no application", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      (policyService as unknown as Dictionary<unknown>).userId = user.id;
      const form = await EntityFormFactory.project().create();
      const project = await processor.create({ formUuid: form.uuid });
      expect(project.isTest).toBe(false);
      expect(project.frameworkKey).toBe(form.frameworkKey);
      expect(project.organisationId).toBe(org.id);
    });

    it("establishes a project user connection", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      (policyService as unknown as Dictionary<unknown>).userId = user.id;
      const form = await EntityFormFactory.project().create();
      const project = await processor.create({ formUuid: form.uuid });
      const projectUser = await ProjectUser.findOne({ where: { projectId: project.id, userId: user.id } });
      expect(projectUser).toBeDefined();
    });

    it("adds all org users when creating with an application", async () => {
      const org = await OrganisationFactory.create();
      const userIds = (await UserFactory.createMany(3, { organisationId: org.id })).map(({ id }) => id);
      const form = await EntityFormFactory.project().create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      const pitch = await ProjectPitchFactory.create();
      await FormSubmissionFactory.create({ applicationId: application.id, projectPitchUuid: pitch.uuid });
      const project = await processor.create({ formUuid: form.uuid, applicationUuid: application.uuid });
      const projectUserIds = (await ProjectUser.findAll({ where: { projectId: project.id } })).map(
        ({ userId }) => userId
      );
      expect(userIds.sort()).toEqual(projectUserIds.sort());
    });

    it("throws if the application doesn't have a pitch", async () => {
      const org = await OrganisationFactory.create();
      const form = await EntityFormFactory.project().create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      await expect(processor.create({ formUuid: form.uuid, applicationUuid: application.uuid })).rejects.toThrow(
        `No pitch found for application: ${application.uuid}`
      );
    });

    it("copies application attributes when creating the project", async () => {
      const org = await OrganisationFactory.create();
      const form = await EntityFormFactory.project().create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      const pitch = await ProjectPitchFactory.create({
        // Spot check a couple attributes
        projectName: "Test Pitch",
        descriptionOfProjectTimeline: faker.lorem.paragraph()
      });
      await FormSubmissionFactory.create({ applicationId: application.id, projectPitchUuid: pitch.uuid });

      const project = await processor.create({ formUuid: form.uuid, applicationUuid: application.uuid });
      expect(project.applicationId).toBe(application.id);
      expect(project.organisationId).toBe(org.id);
      expect(project.frameworkKey).toBe(form.frameworkKey);
      expect(project.name).toBe(pitch.projectName);
      expect(project.descriptionOfProjectTimeline).toBe(pitch.descriptionOfProjectTimeline);
    });

    it("copies trees, demographics and media from the pitch when creating the project", async () => {
      const org = await OrganisationFactory.create();
      const form = await EntityFormFactory.project().create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      const pitch = await ProjectPitchFactory.create({});
      await FormSubmissionFactory.create({ applicationId: application.id, projectPitchUuid: pitch.uuid });

      const pitchTrees = await TreeSpeciesFactory.projectPitchTreePlanted(pitch).createMany(3);
      // hidden trees should be ignored
      await TreeSpeciesFactory.projectPitchTreePlanted(pitch).create({ hidden: true });

      const pitchDemographic = await TrackingFactory.projectPitch(pitch).create();
      const pitchEntries = await Promise.all([
        TrackingEntryFactory.gender(pitchDemographic).create({ amount: 10 }),
        TrackingEntryFactory.age(pitchDemographic).create({ amount: 10 })
      ]);

      const pitchMedia = await MediaFactory.projectPitch(pitch).create({ collectionName: "detailed_project_budget" });
      await MediaFactory.projectPitch(pitch).create({ collectionName: "ignored_collection" });

      const project = await processor.create({ formUuid: form.uuid, applicationUuid: application.uuid });
      const projectTrees = await TreeSpecies.for(project).findAll();
      expect(projectTrees.length).toBe(pitchTrees.length);
      for (const { collection, name, taxonId, amount } of pitchTrees) {
        expect(projectTrees).toContainEqual(
          expect.objectContaining({
            collection,
            name,
            taxonId,
            amount
          })
        );
      }

      const projectDemographics = await Tracking.for(project).findAll();
      expect(projectDemographics.length).toBe(1);
      expect(projectDemographics[0].type).toBe(pitchDemographic.type);
      expect(projectDemographics[0].collection).toBe(pitchDemographic.collection);
      const projectEntries = await TrackingEntry.tracking(projectDemographics[0].id).findAll();
      expect(projectEntries.length).toBe(pitchEntries.length);
      for (const { type, subtype, amount } of pitchEntries) {
        expect(projectEntries).toContainEqual(
          expect.objectContaining({
            type,
            subtype,
            amount
          })
        );
      }

      expect(mediaService.duplicateMedia).toHaveBeenCalledTimes(1);
      expect(mediaService.duplicateMedia).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: pitchMedia.uuid }),
        expect.objectContaining({ uuid: project.uuid })
      );
    });
  });
});
