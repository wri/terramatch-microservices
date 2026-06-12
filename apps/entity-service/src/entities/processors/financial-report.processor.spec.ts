import { Response } from "express";
import {
  FinancialIndicator,
  FinancialReport,
  FundingType,
  Media,
  Organisation,
  User
} from "@terramatch-microservices/database/entities";
import { DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { orderBy, reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  EntityFormFactory,
  FinancialIndicatorFactory,
  FinancialReportFactory,
  FundingTypeFactory,
  MediaFactory,
  OrganisationFactory
} from "@terramatch-microservices/database/factories";
import { APPROVED, AWAITING_APPROVAL } from "@terramatch-microservices/database/constants/status";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { FinancialReportProcessor } from "./financial-report.processor";
import { FinancialIndicatorDto } from "@terramatch-microservices/common/dto/financial-indicator.dto";
import { EmbeddedMediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { FundingTypeDto } from "@terramatch-microservices/common/dto/funding-type.dto";
import { mockEntityService } from "./entity.processor.spec";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { setMockedPermissions } from "@terramatch-microservices/common/util/testing";
import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TestingModule } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

describe("FinancialReportProcessor", () => {
  let module: TestingModule;
  let processor: FinancialReportProcessor;

  const csvExportService = (): DeepMocked<CsvExportService> => module.get(CsvExportService);
  const entitiesService = () => module.get(EntitiesService);

  beforeEach(async () => {
    await FinancialReport.truncate();
    await FinancialIndicator.truncate();
    await FundingType.truncate();
    await Organisation.truncate();

    module = await mockEntityService();
    processor = module.get(EntitiesService).createEntityProcessor("financialReports") as FinancialReportProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("findOne", () => {
    it("should return a financial report with associations", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.org(organisation).create();

      const result = await processor.findOne(financialReport.uuid);

      expect(result).toBeDefined();
      expect(result?.id).toBe(financialReport.id);
      expect(result?.organisation).toBeDefined();
      expect(result?.organisation?.id).toBe(organisation.id);
    });

    it("should return null for non-existent uuid", async () => {
      const result = await processor.findOne("non-existent-uuid");
      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    async function expectFinancialReports(
      expected: FinancialReport[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = [],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      setMockedPermissions(...permissions);
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should filter by status", async () => {
      const organisation = await OrganisationFactory.create();
      const approvedReports = await FinancialReportFactory.org(organisation).createMany(2, { status: "approved" });
      await FinancialReportFactory.org(organisation).createMany(3, { status: "started" });

      await expectFinancialReports(approvedReports, { status: "approved" });
    });

    it("should filter by organisationUuid", async () => {
      const organisation1 = await OrganisationFactory.create();
      const organisation2 = await OrganisationFactory.create();

      const reports1 = await FinancialReportFactory.org(organisation1).createMany(2);
      await FinancialReportFactory.org(organisation2).createMany(3);

      await expectFinancialReports(reports1, { organisationUuid: organisation1.uuid });
    });

    it("should search by organisation name", async () => {
      const organisation = await OrganisationFactory.create({ name: "Test Organisation" });
      const financialReports = await FinancialReportFactory.org(organisation).createMany(2);
      await FinancialReportFactory.org().createMany(3);

      await expectFinancialReports(financialReports, { search: "Test Organisation" });
    });

    it("should search by title", async () => {
      const financialReport = await FinancialReportFactory.org().create({ title: "Special Report Title" });
      await FinancialReportFactory.org().createMany(3);

      await expectFinancialReports([financialReport], { search: "Special Report Title" });
    });

    it("should sort by valid fields", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReports = await FinancialReportFactory.org(organisation).createMany(3);

      await expectFinancialReports(financialReports, { sort: { field: "createdAt", direction: "ASC" } });
      await expectFinancialReports(financialReports, { sort: { field: "status", direction: "DESC" } });
    });

    it("should sort by organisation name", async () => {
      const organisation = await OrganisationFactory.create({ name: "A Organisation" });
      const financialReports = await FinancialReportFactory.org(organisation).createMany(3);

      await expectFinancialReports(financialReports, { sort: { field: "organisationName", direction: "ASC" } });
    });

    it("should throw error for invalid sort field", async () => {
      await expect(processor.findMany({ sort: { field: "invalidField", direction: "ASC" } })).rejects.toThrow(
        BadRequestException
      );
    });

    it("should handle pagination", async () => {
      const organisation = await OrganisationFactory.create();
      await FinancialReportFactory.org(organisation).createMany(5);

      const result = await processor.findMany({ page: { size: 2, number: 1 } });
      expect(result.models.length).toBe(2);
      expect(result.paginationTotal).toBe(5);
    });

    it("should restrict project managers to their organisation", async () => {
      const organisation1 = await OrganisationFactory.create();
      const organisation2 = await OrganisationFactory.create();
      const reports1 = await FinancialReportFactory.org(organisation1).createMany(2);
      await FinancialReportFactory.org(organisation2).createMany(2);

      jest.spyOn(User, "findOne").mockResolvedValue({
        organisationId: organisation1.id,
        primaryRole: "project-manager"
      } as User);

      await expectFinancialReports(reports1, {});
    });

    it("should filter by updateRequestStatus", async () => {
      const organisation = await OrganisationFactory.create();
      const awaiting = await FinancialReportFactory.org(organisation).createMany(2, {
        updateRequestStatus: AWAITING_APPROVAL
      });
      await FinancialReportFactory.org(organisation).create({ updateRequestStatus: APPROVED });

      await expectFinancialReports(awaiting, { updateRequestStatus: AWAITING_APPROVAL });
    });

    it("should filter by frameworkKey", async () => {
      const organisation = await OrganisationFactory.create();
      const ppc = await FinancialReportFactory.org(organisation).createMany(2, { frameworkKey: "ppc" });
      await FinancialReportFactory.org(organisation).create({ frameworkKey: "terrafund" });

      await expectFinancialReports(ppc, { frameworkKey: ["ppc"] });
    });

    it("should sort by submittedAt and dueAt", async () => {
      const organisation = await OrganisationFactory.create();
      const r1 = await FinancialReportFactory.org(organisation).create({
        submittedAt: new Date("2024-01-01")
      });
      const r2 = await FinancialReportFactory.org(organisation).create({
        submittedAt: new Date("2024-06-01")
      });
      await expectFinancialReports(
        [r1, r2],
        { sort: { field: "submittedAt", direction: "ASC" } },
        {
          sortField: "submittedAt"
        }
      );
      await FinancialReport.destroy({ where: {} });
      const d1 = await FinancialReportFactory.org(organisation).create({ dueAt: new Date("2025-01-01") });
      const d2 = await FinancialReportFactory.org(organisation).create({ dueAt: new Date("2025-12-01") });
      await expectFinancialReports([d1, d2], { sort: { field: "dueAt", direction: "ASC" } }, { sortField: "dueAt" });
    });
  });

  describe("getFullDto", () => {
    it("should return full DTO with funding types and financial indicators", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.org(organisation).create();

      await financialReport.reload({ include: [{ association: "organisation" }] });

      const getFundingTypesSpy = jest
        .spyOn(processor as unknown as { getFundingTypes: jest.Mock }, "getFundingTypes")
        .mockResolvedValue([]);
      const getFinancialIndicatorsWithMediaSpy = jest
        .spyOn(
          processor as unknown as { getFinancialIndicatorsWithMedia: jest.Mock },
          "getFinancialIndicatorsWithMedia"
        )
        .mockResolvedValue([]);

      const result = await processor.getFullDto(financialReport);

      expect(result.id).toBe(financialReport.uuid);
      expect(result.dto).toBeDefined();
      expect(getFundingTypesSpy).toHaveBeenCalledWith(financialReport);
      expect(getFinancialIndicatorsWithMediaSpy).toHaveBeenCalledWith(financialReport);
    });
  });

  describe("getLightDto", () => {
    it("should return light DTO", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.org(organisation).create();

      await financialReport.reload({ include: [{ association: "organisation" }] });

      const result = await processor.getLightDto(financialReport);

      expect(result.id).toBe(financialReport.uuid);
      expect(result.dto).toBeDefined();
    });
  });

  describe("getFundingTypes", () => {
    it("should return funding types for financial report", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.org(organisation).create();
      await FundingTypeFactory.report(financialReport, organisation).createMany(2);

      await financialReport.reload({ include: [{ association: "organisation" }] });

      const result = await (
        processor as unknown as { getFundingTypes: (report: FinancialReport) => Promise<FundingTypeDto[]> }
      ).getFundingTypes(financialReport);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(FundingTypeDto);
      // Ensure DTOs are populated with association props
      expect(result[0].entityType).toBe("financialReports");
      expect(typeof result[0].entityUuid).toBe("string");
    });
  });

  describe("getFinancialIndicatorsWithMedia", () => {
    it("should return financial indicators with documentation media", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.org(organisation).create();
      const indicators = await FinancialIndicatorFactory.report(financialReport).createMany(2);
      const media = await MediaFactory.financialIndicator(indicators[0]).create({ collectionName: "documentation" });

      jest.spyOn(Media, "for").mockImplementation((owner: FinancialIndicator) => {
        const scopedMedia = owner.id === indicators[0].id ? [media] : [];
        return {
          findAll: jest.fn().mockResolvedValue(scopedMedia)
        } as ReturnType<typeof Media.for>;
      });

      const mediaService = module.get(MediaService);
      mediaService.embeddedDocumentationDto.mockImplementation(
        async (documentationMedia: Media) =>
          new EmbeddedMediaDto(documentationMedia, { url: "signed-url", thumbUrl: null })
      );

      const result = (await Promise.all(
        await (
          processor as unknown as { getFinancialIndicatorsWithMedia: (report: FinancialReport) => Promise<unknown[]> }
        ).getFinancialIndicatorsWithMedia(financialReport)
      )) as FinancialIndicatorDto[];

      expect(result).toHaveLength(2);
      expect(result.find(indicator => indicator.documentation != null)?.documentation).toEqual([
        expect.objectContaining({ uuid: media.uuid, url: "signed-url" })
      ]);
      expect(result.find(indicator => indicator.documentation == null)).toBeDefined();
      expect(mediaService.embeddedDocumentationDto).toHaveBeenCalledWith(media);
    });
  });

  describe("export", () => {
    it("throws if the report is not found", async () => {
      await expect(processor.export("fake-uuid", {} as Response)).rejects.toThrow(NotFoundException);
    });

    it("throws if the report is missing a framework key", async () => {
      const report = await FinancialReportFactory.org().create({ frameworkKey: null });
      await expect(processor.export(report.uuid, {} as Response)).rejects.toThrow(InternalServerErrorException);
    });

    it("calls entity export", async () => {
      const report = await FinancialReportFactory.org().create({ frameworkKey: "ppc" });
      const exportSpy = jest.spyOn(entitiesService(), "entityExport").mockResolvedValue();
      await processor.export(report.uuid, {} as Response);
      expect(exportSpy).toHaveBeenCalledWith(
        "financialReports",
        expect.anything(),
        [expect.objectContaining({ uuid: report.uuid })],
        expect.anything()
      );
    });
  });

  describe("exportAll", () => {
    it("throws when target is missing", async () => {
      await expect(processor.exportAll({ frameworkKey: "ppc" })).rejects.toThrow(InternalServerErrorException);
    });

    it("throws when frameworkKey is missing", async () => {
      await expect(processor.exportAll({ target: {} as Response })).rejects.toThrow(BadRequestException);
    });

    it("writes all reports to the CSV", async () => {
      await FinancialReport.truncate();
      const organisations = orderBy(await OrganisationFactory.createMany(2, { isTest: false }), "id");
      const reports = [
        await FinancialReportFactory.org(organisations[0]).create({ frameworkKey: "ppc" }),
        await FinancialReportFactory.org(organisations[1]).create({ frameworkKey: "ppc" })
      ];

      await EntityFormFactory.for(reports[0]).create();

      const addRow = jest.fn();
      csvExportService().writeCsv.mockImplementation(async (fileName, response, columns, writeRows) => {
        await writeRows(addRow);
      });
      setMockedPermissions("framework-ppc");
      await processor.exportAll({ target: {} as Response, frameworkKey: "ppc" });

      expect(addRow).toHaveBeenCalledTimes(2);
      expect(addRow).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          uuid: reports[0].uuid,
          organisationUuid: organisations[0].uuid,
          organisationName: organisations[0].name
        }),
        expect.anything()
      );
      expect(addRow).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          uuid: reports[1].uuid,
          organisationUuid: organisations[1].uuid,
          organisationName: organisations[1].name
        }),
        expect.anything()
      );
    });
  });
});
