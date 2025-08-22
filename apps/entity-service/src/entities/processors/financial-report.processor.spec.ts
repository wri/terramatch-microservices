/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FinancialReport, Media } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  FinancialReportFactory,
  OrganisationFactory,
  UserFactory,
  FundingTypeFactory,
  FinancialIndicatorFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { FinancialReportProcessor } from "./financial-report.processor";
import { PolicyService } from "@terramatch-microservices/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { FundingTypeDto } from "../dto/funding-type.dto";

describe("FinancialReportProcessor", () => {
  let processor: FinancialReportProcessor;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await FinancialReport.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("financialReports") as FinancialReportProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("findOne", () => {
    it("should return a financial report with associations", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.create({ organisationId: organisation.id });

      const result = await processor.findOne(financialReport.uuid);

      expect(result).toBeDefined();
      expect(result?.id).toBe(financialReport.id);
      expect(result?.organisation).toBeDefined();
      expect(result?.organisation.id).toBe(organisation.id);
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
      policyService.getPermissions.mockResolvedValue(permissions);
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should filter by status", async () => {
      const organisation = await OrganisationFactory.create();
      const approvedReports = await FinancialReportFactory.createMany(2, {
        organisationId: organisation.id,
        status: "approved"
      });
      await FinancialReportFactory.createMany(3, {
        organisationId: organisation.id,
        status: "started"
      });

      await expectFinancialReports(approvedReports, { status: "approved" });
    });

    it("should filter by organisationUuid", async () => {
      const organisation1 = await OrganisationFactory.create();
      const organisation2 = await OrganisationFactory.create();

      const reports1 = await FinancialReportFactory.createMany(2, { organisationId: organisation1.id });
      await FinancialReportFactory.createMany(3, { organisationId: organisation2.id });

      await expectFinancialReports(reports1, { organisationUuid: organisation1.uuid });
    });

    it("should search by organisation name", async () => {
      const organisation = await OrganisationFactory.create({ name: "Test Organisation" });
      const financialReports = await FinancialReportFactory.createMany(2, { organisationId: organisation.id });
      await FinancialReportFactory.createMany(3);

      await expectFinancialReports(financialReports, { search: "Test Organisation" });
    });

    it("should search by title", async () => {
      const financialReport = await FinancialReportFactory.create({ title: "Special Report Title" });
      await FinancialReportFactory.createMany(3);

      await expectFinancialReports([financialReport], { search: "Special Report Title" });
    });

    it("should sort by valid fields", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReports = await FinancialReportFactory.createMany(3, { organisationId: organisation.id });

      await expectFinancialReports(financialReports, { sort: { field: "createdAt", direction: "ASC" } });
      await expectFinancialReports(financialReports, { sort: { field: "status", direction: "DESC" } });
    });

    it("should sort by organisation name", async () => {
      const organisation = await OrganisationFactory.create({ name: "A Organisation" });
      const financialReports = await FinancialReportFactory.createMany(3, { organisationId: organisation.id });

      await expectFinancialReports(financialReports, { sort: { field: "organisationName", direction: "ASC" } });
    });

    it("should throw error for invalid sort field", async () => {
      await expect(processor.findMany({ sort: { field: "invalidField", direction: "ASC" } })).rejects.toThrow(
        BadRequestException
      );
    });

    it("should handle pagination", async () => {
      const organisation = await OrganisationFactory.create();
      await FinancialReportFactory.createMany(5, { organisationId: organisation.id });

      const result = await processor.findMany({ page: { size: 2, number: 1 } });
      expect(result.models.length).toBe(2);
      expect(result.paginationTotal).toBe(5);
    });
  });

  describe("getFullDto", () => {
    it("should return full DTO with funding types and financial indicators", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.create({ organisationId: organisation.id });

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
      const financialReport = await FinancialReportFactory.create({ organisationId: organisation.id });

      await financialReport.reload({ include: [{ association: "organisation" }] });

      const result = await processor.getLightDto(financialReport);

      expect(result.id).toBe(financialReport.uuid);
      expect(result.dto).toBeDefined();
    });
  });

  describe("getFundingTypes", () => {
    it("should return funding types for organisation", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.create({ organisationId: organisation.id });
      await FundingTypeFactory.createMany(2, { organisationId: organisation.uuid });

      await financialReport.reload({ include: [{ association: "organisation" }] });

      const result = await (
        processor as unknown as { getFundingTypes: (report: FinancialReport) => Promise<unknown[]> }
      ).getFundingTypes(financialReport);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(FundingTypeDto);
    });
  });

  describe("getFinancialIndicatorsWithMedia", () => {
    it("should return financial indicators with media", async () => {
      const organisation = await OrganisationFactory.create();
      const financialReport = await FinancialReportFactory.create({ organisationId: organisation.id });
      await FinancialIndicatorFactory.createMany(2, {
        financialReportId: financialReport.id
      });

      const mockMedia = { findAll: jest.fn().mockResolvedValue([]) };
      jest.spyOn(Media, "for").mockReturnValue(mockMedia as unknown as ReturnType<typeof Media.for>);

      const result = await (
        processor as unknown as { getFinancialIndicatorsWithMedia: (report: FinancialReport) => Promise<unknown[]> }
      ).getFinancialIndicatorsWithMedia(financialReport);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Promise);
    });
  });
});
