/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SrpReport } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  SrpReportFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { SrpReportProcessor } from "./srp-report.processor";
import { PolicyService } from "@terramatch-microservices/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("SrpReportProcessor", () => {
  let processor: SrpReportProcessor;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await SrpReport.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("srpReports") as SrpReportProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("findOne", () => {
    it("should return a srp report with associations", async () => {
      const project = await ProjectFactory.create();
      const srpReport = await SrpReportFactory.create({ projectId: project.id });

      const result = await processor.findOne(srpReport.uuid);

      expect(result).toBeDefined();
      expect(result?.id).toBe(srpReport.id);
      expect(result?.project).toBeDefined();
      expect(result?.project?.id).toBe(project.id);
      expect(result?.project?.uuid).toBe(project.uuid);
      expect(result?.project?.name).toBe(project.name);
    });

    it("should return null for non-existent uuid", async () => {
      const result = await processor.findOne("non-existent-uuid");
      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    async function expectSrpReports(
      expected: SrpReport[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = [],
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

    it("should filter by status", async () => {
      const project = await ProjectFactory.create();
      const approvedReports = await SrpReportFactory.createMany(2, {
        projectId: project.id,
        status: "approved"
      });
      await SrpReportFactory.createMany(3, {
        projectId: project.id,
        status: "started"
      });

      await expectSrpReports(approvedReports, { status: "approved" });
    });

    it("should filter by projectUuid", async () => {
      const project1 = await ProjectFactory.create();
      const project2 = await ProjectFactory.create();

      const reports1 = await SrpReportFactory.createMany(2, { projectId: project1.id });
      await SrpReportFactory.createMany(3, { projectId: project2.id });

      await expectSrpReports(reports1, { projectUuid: project1.uuid });
    });

    it("should search by project name", async () => {
      const project = await ProjectFactory.create({ name: "Test Project" });
      const disturbanceReports = await SrpReportFactory.createMany(2, { projectId: project.id });
      await SrpReportFactory.createMany(3);

      await expectSrpReports(disturbanceReports, { search: "Test Project" });
    });

    it("should search by title", async () => {
      const srpReport = await SrpReportFactory.create({ title: "Special Report Title" });
      await SrpReportFactory.createMany(3);

      await expectSrpReports([srpReport], { search: "Special Report Title" });
    });

    it("should sort by valid fields", async () => {
      const project = await ProjectFactory.create();
      const srpReports = await SrpReportFactory.createMany(3, { projectId: project.id });

      await expectSrpReports(srpReports, { sort: { field: "createdAt", direction: "ASC" } });
      await expectSrpReports(srpReports, { sort: { field: "status", direction: "DESC" } });
    });

    it("should sort by project name", async () => {
      const project = await ProjectFactory.create({ name: "A Project" });
      const srpReports = await SrpReportFactory.createMany(3, { projectId: project.id });

      await expectSrpReports(srpReports, { sort: { field: "projectName", direction: "ASC" } });
    });

    it("should returns managed project reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const projectReports = await SrpReportFactory.createMany(3, { projectId: project.id });
      await SrpReportFactory.createMany(5);
      await expectSrpReports(projectReports, {}, { permissions: ["projects-manage"] });
    });

    it("should returns framework disturbance reports", async () => {
      const srpReports = await SrpReportFactory.createMany(3, { frameworkKey: "hbf" });
      await SrpReportFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await SrpReportFactory.createMany(3, { frameworkKey: "terrafund" })) {
        srpReports.push(p);
      }

      await expectSrpReports(srpReports, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("should returns own project disturbance reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const ownProjectReports = await SrpReportFactory.createMany(3, { projectId: project.id });
      await SrpReportFactory.createMany(5);

      await expectSrpReports(ownProjectReports, {}, { permissions: ["manage-own"] });
    });

    it("should filter by framework key when user has framework permissions", async () => {
      const ppcReports = await SrpReportFactory.createMany(2, { frameworkKey: "ppc" });
      await SrpReportFactory.createMany(3, { frameworkKey: "terrafund" });

      await expectSrpReports(ppcReports, {}, { permissions: ["framework-ppc"] });
    });

    it("should throw error for invalid sort field", async () => {
      await expect(processor.findMany({ sort: { field: "invalidField", direction: "ASC" } })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("getFullDto", () => {
    it("should return full DTO with entries and extracted fields", async () => {
      const project = await ProjectFactory.create();
      const srpReport = await SrpReportFactory.create({ projectId: project.id });

      const result = await processor.getFullDto(srpReport);

      expect(result.id).toBe(srpReport.uuid);
      expect(result.dto).toBeDefined();
      expect(result.dto.otherRestorationPartnersDescription).toBe("Other Restoration Partners Description");
      expect(result.dto.totalUniqueRestorationPartners).toBe(10);
    });
  });

  describe("getLightDto", () => {
    it("should return light DTO with entries and extracted fields", async () => {
      const project = await ProjectFactory.create();
      const srpReport = await SrpReportFactory.create({ projectId: project.id });

      await srpReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getLightDto(srpReport);

      expect(result.id).toBe(srpReport.uuid);
      expect(result.dto).toBeDefined();
    });
  });
});
