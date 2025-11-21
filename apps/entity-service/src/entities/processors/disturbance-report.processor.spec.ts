/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DisturbanceReport, Disturbance, SitePolygon } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  DisturbanceReportFactory,
  DisturbanceReportEntryFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory,
  SitePolygonFactory
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
    it("should return full DTO with entries and extracted fields", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      // Create entries
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "intensity",
        value: "high",
        inputType: "select"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "date-of-disturbance",
        value: "2023-12-01",
        inputType: "date"
      });

      await disturbanceReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getFullDto(disturbanceReport);

      expect(result.id).toBe(disturbanceReport.uuid);
      expect(result.dto).toBeDefined();
      expect(result.dto.entries).toHaveLength(2);
      expect(result.dto.intensity).toBe("high");
      expect(result.dto.dateOfDisturbance).toEqual(new Date("2023-12-01"));
    });

    it("should handle missing entry values", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      // Create entry without intensity
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "other-field",
        value: "some-value",
        inputType: "text"
      });

      await disturbanceReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getFullDto(disturbanceReport);

      expect(result.id).toBe(disturbanceReport.uuid);
      expect(result.dto).toBeDefined();
      expect(result.dto.entries).toHaveLength(1);
      expect(result.dto.intensity).toBeNull();
      expect(result.dto.dateOfDisturbance).toBeNull();
    });
  });

  describe("getLightDto", () => {
    it("should return light DTO with entries and extracted fields", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      // Create entries
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "intensity",
        value: "medium",
        inputType: "select"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "date-of-disturbance",
        value: "2023-11-15",
        inputType: "date"
      });

      await disturbanceReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getLightDto(disturbanceReport);

      expect(result.id).toBe(disturbanceReport.uuid);
      expect(result.dto).toBeDefined();
      expect(result.dto.entries).toHaveLength(2);
      expect(result.dto.intensity).toBe("medium");
      expect(result.dto.dateOfDisturbance).toEqual(new Date("2023-11-15"));
    });

    it("should handle missing entry values in light DTO", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      // No entries created

      await disturbanceReport.reload({ include: [{ association: "project" }] });

      const result = await processor.getLightDto(disturbanceReport);

      expect(result.id).toBe(disturbanceReport.uuid);
      expect(result.dto).toBeDefined();
      expect(result.dto.entries).toHaveLength(0);
      expect(result.dto.intensity).toBeNull();
      expect(result.dto.dateOfDisturbance).toBeNull();
    });
  });

  describe("getDisturbanceReportEntries", () => {
    it("should return entries for a disturbance report", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      // Create multiple entries
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "intensity",
        value: "low",
        inputType: "select"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "date-of-disturbance",
        value: "2023-10-01",
        inputType: "date"
      });

      const entries = await processor.getDisturbanceReportEntries(disturbanceReport);
      expect(entries).toHaveLength(2);

      const intensity = entries.find(({ name }) => name === "intensity");
      expect(intensity?.value).toBe("low");
      const date = entries.find(({ name }) => name === "date-of-disturbance");
      expect(date?.value).toBe("2023-10-01");
    });

    it("should return empty array when no entries exist", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({ projectId: project.id });

      const entries = await processor.getDisturbanceReportEntries(disturbanceReport);

      expect(entries).toHaveLength(0);
    });
  });

  describe("processReportSpecificLogic", () => {
    it("upserts disturbance and sets disturbanceId on polygons parsed from JSON", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({
        projectId: project.id,
        description: "desc",
        actionDescription: "act",
        status: "awaiting-approval"
      });

      const poly1 = await SitePolygonFactory.create();
      const poly2 = await SitePolygonFactory.create();

      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "polygon-affected",
        value: JSON.stringify([{ polyUuid: poly1.uuid }, { polyUuid: poly2.uuid }]),
        inputType: "text"
      });

      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "intensity",
        value: "high",
        inputType: "select"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "extent",
        value: "large",
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "disturbance-type",
        value: "fire",
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "disturbance-subtype",
        value: JSON.stringify({ code: "wild" }),
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "people-affected",
        value: "12",
        inputType: "number"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "monetary-damage",
        value: "345.6",
        inputType: "number"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "property-affected",
        value: JSON.stringify({ houses: 3 }),
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "date-of-disturbance",
        value: "2024-01-05",
        inputType: "date"
      });

      await processor.update(disturbanceReport, { status: "approved" });

      const disturbance = await Disturbance.findOne({
        where: { disturbanceableType: DisturbanceReport.LARAVEL_TYPE, disturbanceableId: disturbanceReport.id }
      });
      expect(disturbance).toBeTruthy();
      expect(disturbance?.intensity).toBe("high");
      expect(disturbance?.extent).toBe("large");
      expect(disturbance?.type).toBe("fire");
      expect(disturbance?.peopleAffected).toBe(12);
      expect(disturbance?.monetaryDamage).toBe(345.6);
      expect(disturbance?.description).toBe("desc");
      expect(disturbance?.actionDescription).toBe("act");
      expect(disturbance?.disturbanceDate?.toISOString()).toBe(new Date("2024-01-05").toISOString());

      const updatedPoly1 = await SitePolygon.findOne({ where: { uuid: poly1.uuid } });
      const updatedPoly2 = await SitePolygon.findOne({ where: { uuid: poly2.uuid } });
      expect(updatedPoly1?.disturbanceId).toBe(disturbance?.id);
      expect(updatedPoly2?.disturbanceId).toBe(disturbance?.id);
    });

    it("does not overwrite existing polygon disturbanceId and updates only null ones", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({
        projectId: project.id,
        status: "awaiting-approval"
      });

      const preExistingDisturbance = await Disturbance.create({
        disturbanceableType: DisturbanceReport.LARAVEL_TYPE,
        disturbanceableId: disturbanceReport.id,
        hidden: 0
      } as Disturbance);

      const polyWithDist = await SitePolygonFactory.create();
      await polyWithDist.update({ disturbanceId: preExistingDisturbance.id });
      const polyWithoutDist = await SitePolygonFactory.create();

      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "polygon-affected",
        value: JSON.stringify([{ polyUuid: polyWithDist.uuid }, { polyUuid: polyWithoutDist.uuid }]),
        inputType: "text"
      });

      await processor.update(disturbanceReport, { status: "approved" });

      const refreshedWith = await SitePolygon.findOne({ where: { uuid: polyWithDist.uuid } });
      const refreshedWithout = await SitePolygon.findOne({ where: { uuid: polyWithoutDist.uuid } });

      expect(refreshedWith?.disturbanceId).toBe(preExistingDisturbance.id);
      expect(refreshedWithout?.disturbanceId).toBeTruthy();
    });

    it("parses CSV fallback for polygon-affected when JSON fails", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({
        projectId: project.id,
        status: "awaiting-approval"
      });

      const p1 = await SitePolygonFactory.create();
      const p2 = await SitePolygonFactory.create();

      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "polygon-affected",
        value: `${p1.uuid}, ${p2.uuid}`,
        inputType: "text"
      });

      await processor.update(disturbanceReport, { status: "approved" });

      const disturbance = await Disturbance.findOne({
        where: { disturbanceableType: DisturbanceReport.LARAVEL_TYPE, disturbanceableId: disturbanceReport.id }
      });
      expect(disturbance).toBeTruthy();

      const up1 = await SitePolygon.findOne({ where: { uuid: p1.uuid } });
      const up2 = await SitePolygon.findOne({ where: { uuid: p2.uuid } });
      expect(up1?.disturbanceId).toBe(disturbance?.id);
      expect(up2?.disturbanceId).toBe(disturbance?.id);
    });

    it("returns early and does not create disturbance when no polygons provided", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({
        projectId: project.id,
        status: "awaiting-approval"
      });

      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "intensity",
        value: "low",
        inputType: "select"
      });

      await processor.update(disturbanceReport, { status: "approved" });

      const disturbance = await Disturbance.findOne({
        where: { disturbanceableType: DisturbanceReport.LARAVEL_TYPE, disturbanceableId: disturbanceReport.id }
      });
      expect(disturbance).toBeNull();
    });

    it("handles nested arrays in polygon-affected JSON", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({
        projectId: project.id,
        status: "awaiting-approval"
      });

      const p1 = await SitePolygonFactory.create();
      const p2 = await SitePolygonFactory.create();

      const nested = [[{ polyUuid: p1.uuid }], [{ polyUuid: p2.uuid }]];
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "polygon-affected",
        value: JSON.stringify(nested),
        inputType: "text"
      });

      await processor.update(disturbanceReport, { status: "approved" });

      const disturbance = await Disturbance.findOne({
        where: { disturbanceableType: DisturbanceReport.LARAVEL_TYPE, disturbanceableId: disturbanceReport.id }
      });
      expect(disturbance).toBeTruthy();

      const up1 = await SitePolygon.findOne({ where: { uuid: p1.uuid } });
      const up2 = await SitePolygon.findOne({ where: { uuid: p2.uuid } });
      expect(up1?.disturbanceId).toBe(disturbance?.id);
      expect(up2?.disturbanceId).toBe(disturbance?.id);
    });

    it("warns on invalid JSON for subtype and property-affected and ignores invalid date", async () => {
      const project = await ProjectFactory.create();
      const disturbanceReport = await DisturbanceReportFactory.create({
        projectId: project.id,
        status: "awaiting-approval"
      });

      const p = await SitePolygonFactory.create();
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "polygon-affected",
        value: JSON.stringify([{ polyUuid: p.uuid }]),
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "disturbance-subtype",
        value: "{invalid}",
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "property-affected",
        value: "{invalid}",
        inputType: "text"
      });
      await DisturbanceReportEntryFactory.create({
        disturbanceReportId: disturbanceReport.id,
        name: "date-of-disturbance",
        value: "not-a-date",
        inputType: "date"
      });

      const warnSpy = jest.spyOn((processor as unknown as { logger: { warn: (m: string) => void } }).logger, "warn");

      await processor.update(disturbanceReport, { status: "approved" });

      const disturbance = await Disturbance.findOne({
        where: { disturbanceableType: DisturbanceReport.LARAVEL_TYPE, disturbanceableId: disturbanceReport.id }
      });
      expect(disturbance).toBeTruthy();
      expect(disturbance?.subtype).toBeNull();
      expect(disturbance?.propertyAffected).toBeNull();
      expect(disturbance?.disturbanceDate).toBeNull();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
