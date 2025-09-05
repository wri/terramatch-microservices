/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  DisturbanceReportFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { DisturbanceReportProcessor } from "./disturbance-report.processor";
import { PolicyService } from "@terramatch-microservices/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("DisturbanceReportProcessor", () => {
  let processor: DisturbanceReportProcessor;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await DisturbanceReport.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("disturbanceReports") as DisturbanceReportProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("findOne", () => {
    it("should return a disturbance report with associations", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      const result = await processor.findOne(disturbanceReport.uuid);

      expect(result).toBeDefined();
      expect(result?.id).toBe(disturbanceReport.id);
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
    async function expectDisturbanceReports(
      expected: DisturbanceReport[],
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
      const approvedReports = await DisturbanceReportFactory.createMany(2, {
        projectId: project.id,
        status: "approved"
      });
      await DisturbanceReportFactory.createMany(3, {
        projectId: project.id,
        status: "started"
      });

      await expectDisturbanceReports(approvedReports, { status: "approved" });
    });

    it("should filter by projectUuid", async () => {
      const project1 = await ProjectFactory.create();
      const project2 = await ProjectFactory.create();

      const reports1 = await DisturbanceReportFactory.createMany(2, { projectId: project1.id });
      await DisturbanceReportFactory.createMany(3, { projectId: project2.id });

      await expectDisturbanceReports(reports1, { projectUuid: project1.uuid });
    });

    it("should search by project name", async () => {
      const project = await ProjectFactory.create({ name: "Test Project" });
      const disturbanceReports = await DisturbanceReportFactory.createMany(2, { projectId: project.id });
      await DisturbanceReportFactory.createMany(3);

      await expectDisturbanceReports(disturbanceReports, { search: "Test Project" });
    });

    it("should search by title", async () => {
      const disturbanceReport = await DisturbanceReportFactory.create({ title: "Special Report Title" });
      await DisturbanceReportFactory.createMany(3);

      await expectDisturbanceReports([disturbanceReport], { search: "Special Report Title" });
    });

    it("should sort by valid fields", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReports = await DisturbanceReportFactory.createMany(3, { projectId: project.id });

      await expectDisturbanceReports(disturbanceReports, { sort: { field: "createdAt", direction: "ASC" } });
      await expectDisturbanceReports(disturbanceReports, { sort: { field: "status", direction: "DESC" } });
    });

    it("should sort by project name", async () => {
      const project = await ProjectFactory.create({ name: "A Project" });
      const disturbanceReports = await DisturbanceReportFactory.createMany(3, { projectId: project.id });

      await expectDisturbanceReports(disturbanceReports, { sort: { field: "projectName", direction: "ASC" } });
    });

    it("should returns managed project reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const projectReports = await DisturbanceReportFactory.createMany(3, { projectId: project.id });
      await DisturbanceReportFactory.createMany(5);
      await expectDisturbanceReports(projectReports, {}, { permissions: ["projects-manage"] });
    });

    it("should returns framework disturbance reports", async () => {
      const disturbanceReports = await DisturbanceReportFactory.createMany(3, { frameworkKey: "hbf" });
      await DisturbanceReportFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await DisturbanceReportFactory.createMany(3, { frameworkKey: "terrafund" })) {
        disturbanceReports.push(p);
      }

      await expectDisturbanceReports(disturbanceReports, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("should returns own project disturbance reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const ownProjectReports = await DisturbanceReportFactory.createMany(3, { projectId: project.id });
      await DisturbanceReportFactory.createMany(5);

      await expectDisturbanceReports(ownProjectReports, {}, { permissions: ["manage-own"] });
    });

    it("should filter by framework key when user has framework permissions", async () => {
      const ppcReports = await DisturbanceReportFactory.createMany(2, { frameworkKey: "ppc" });
      await DisturbanceReportFactory.createMany(3, { frameworkKey: "terrafund" });

      await expectDisturbanceReports(ppcReports, {}, { permissions: ["framework-ppc"] });
    });

    it("should throw error for invalid sort field", async () => {
      await expect(processor.findMany({ sort: { field: "invalidField", direction: "ASC" } })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("getFullDto", () => {
    it("should return full DTO", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      await disturbanceReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getFullDto(disturbanceReport);

      expect(result.id).toBe(disturbanceReport.uuid);
      expect(result.dto).toBeDefined();
    });
  });

  describe("getLightDto", () => {
    it("should return light DTO", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      await disturbanceReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getLightDto(disturbanceReport);

      expect(result.id).toBe(disturbanceReport.uuid);
      expect(result.dto).toBeDefined();
    });
  });
});
