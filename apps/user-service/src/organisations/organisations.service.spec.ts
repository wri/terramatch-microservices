import { OrganisationsService } from "./organisations.service";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import { OrganisationShowQueryDto } from "./dto/organisation-show-query.dto";
import { faker } from "@faker-js/faker";
import {
  OrganisationFactory,
  UserFactory,
  ProjectFactory,
  FinancialIndicatorFactory,
  FinancialReportFactory,
  MediaFactory,
  LeadershipFactory,
  OwnershipStakeFactory,
  FundingTypeFactory
} from "@terramatch-microservices/database/factories";
import { Organisation, Media, TreeSpecies } from "@terramatch-microservices/database/entities";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { OrganisationFullDto } from "@terramatch-microservices/common/dto";

describe("OrganisationsService", () => {
  let service: OrganisationsService;
  let policyService: DeepMocked<PolicyService>;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: getQueueToken("email"), useValue: {} }
      ]
    }).compile();

    service = module.get(OrganisationsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findMany", () => {
    it("should return organisations for admin user", async () => {
      await OrganisationFactory.createMany(2);
      policyService.getPermissions.mockResolvedValue(["framework-test"]);

      const result = await service.findMany({});

      expect(result.organisations.length).toBeGreaterThanOrEqual(2);
      expect(result.paginationTotal).toBeGreaterThanOrEqual(2);
    });

    it("should throw error if non-admin user is not authenticated", async () => {
      mockUserId(undefined);
      policyService.getPermissions.mockResolvedValue([]);
      await expect(service.findMany({})).rejects.toThrow(BadRequestException);
    });

    it("should filter organisations by user's orgs and projects for non-admin", async () => {
      const user = await UserFactory.create();
      const org1 = await OrganisationFactory.create();
      const org2 = await OrganisationFactory.create();
      await user.update({ organisationId: org1.id });
      const project = await ProjectFactory.create({ organisationId: org2.id });
      await user.$add("projects", project);

      mockUserId(user.id);
      policyService.getPermissions.mockResolvedValue([]);
      const result = await service.findMany({});

      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by funding programme UUID", async () => {
      const programmeUuid = faker.string.uuid();
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      await service.findMany({ fundingProgrammeUuid: programmeUuid });
    });

    it("should filter by search query", async () => {
      await OrganisationFactory.create({ name: "Test Organisation" });
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      const result = await service.findMany({ search: "Test" });
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by status", async () => {
      await OrganisationFactory.create({ status: "pending" });
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      const result = await service.findMany({ status: "pending" });
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by type", async () => {
      await OrganisationFactory.create({ type: "non-profit-organization" });
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      const result = await service.findMany({ type: "non-profit-organization" });
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by hqCountry", async () => {
      const country = faker.location.countryCode("alpha-3");
      await OrganisationFactory.create({ hqCountry: country });
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      const result = await service.findMany({ hqCountry: country });
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should sort by valid field", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      await service.findMany({ sort: { field: "name", direction: "ASC" } });
    });

    it("should sort by mapped field", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      await service.findMany({ sort: { field: "created_at", direction: "ASC" } });
    });

    it("should handle descending sort", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      await service.findMany({ sort: { field: "-name" } });
    });

    it("should throw error for invalid sort field", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      await expect(service.findMany({ sort: { field: "invalidField" } })).rejects.toThrow(BadRequestException);
    });

    it("should allow sorting by id field", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      await service.findMany({ sort: { field: "id" } });
    });
  });

  describe("findOne", () => {
    it("should return organisation by UUID", async () => {
      const org = await OrganisationFactory.create();
      const result = await service.findOne(org.uuid);

      expect(result.uuid).toBe(org.uuid);
      expect(result.id).toBe(org.id);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = faker.string.uuid();
      await expect(service.findOne(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update organisation attributes", async () => {
      const org = await OrganisationFactory.create();
      const updateAttrs: OrganisationUpdateAttributes = {
        name: "Updated Name",
        status: "pending",
        phone: "1234567890"
      };

      const updated = await service.update(org, updateAttrs);

      expect(updated.name).toBe("Updated Name");
      expect(updated.status).toBe("pending");
      expect(updated.phone).toBe("1234567890");
    });

    it("should only update provided attributes", async () => {
      const org = await OrganisationFactory.create({ name: "Original Name", type: "non-profit-organization" });
      const updateAttrs: OrganisationUpdateAttributes = {
        name: "Updated Name"
      };

      const updated = await service.update(org, updateAttrs);

      expect(updated.name).toBe("Updated Name");
      expect(updated.type).toBe("non-profit-organization");
    });

    it("should ignore undefined values", async () => {
      const org = await OrganisationFactory.create({ name: "Original Name" });
      const updateAttrs: OrganisationUpdateAttributes = {
        name: "Updated Name",
        phone: undefined
      };

      const updated = await service.update(org, updateAttrs);

      expect(updated.name).toBe("Updated Name");
    });
  });

  describe("delete", () => {
    it("should delete organisation", async () => {
      const org = await OrganisationFactory.create();
      const orgId = org.id;

      await service.delete(org);

      const deleted = await Organisation.findByPk(orgId);
      expect(deleted).toBeNull();
    });
  });

  describe("processSideloads", () => {
    it("should return early if no sideloads provided", async () => {
      const org = await OrganisationFactory.create();
      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = {};

      await service.processSideloads(document, org, query);

      expect(document.included).toHaveLength(0);
    });

    it("should process financialCollection sideload", async () => {
      const org = await OrganisationFactory.create();
      const indicator = await FinancialIndicatorFactory.org(org).create();
      await MediaFactory.financialIndicator(indicator).create({
        collectionName: "documentation"
      });

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["financialCollection"] };

      mediaService.getUrl.mockImplementation((m: Media, variant?: string) => {
        const suffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${m.id}${suffix}`;
      });

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const indicatorResource = document.included.find(r => r.id === indicator.uuid);
      expect(indicatorResource).toBeDefined();
    });

    it("should process financialReport sideload", async () => {
      const org = await OrganisationFactory.create();
      const report = await FinancialReportFactory.org(org).create();

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["financialReport"] };

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const reportResource = document.included.find(r => r.id === report.uuid);
      expect(reportResource).toBeDefined();
    });

    it("should process media sideload", async () => {
      const org = await OrganisationFactory.create();
      const media = await MediaFactory.org(org).create({ collectionName: "cover" });

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["media"] };

      mediaService.getUrl.mockImplementation((m: Media, variant?: string) => {
        const suffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${m.id}${suffix}`;
      });

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const mediaResource = document.included.find(r => r.id === media.uuid);
      expect(mediaResource).toBeDefined();
    });

    it("should process fundingTypes sideload", async () => {
      const org = await OrganisationFactory.create();
      const fundingType = await FundingTypeFactory.org(org).create();

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["fundingTypes"] };

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const fundingTypeResource = document.included.find(r => r.id === fundingType.uuid);
      expect(fundingTypeResource).toBeDefined();
    });

    it("should process leadership sideload", async () => {
      const org = await OrganisationFactory.create();
      const leadership = await LeadershipFactory.org(org).create({
        collection: "leadership-team"
      });

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["leadership"] };

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const leadershipResource = document.included.find(r => r.id === leadership.uuid);
      expect(leadershipResource).toBeDefined();
    });

    it("should process ownershipStakes sideload", async () => {
      const org = await OrganisationFactory.create();
      const stake = await OwnershipStakeFactory.org(org).create();

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["ownershipStakes"] };

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const stakeResource = document.included.find(r => r.id === stake.uuid);
      expect(stakeResource).toBeDefined();
    });

    it("should process treeSpeciesHistorical sideload", async () => {
      const org = await OrganisationFactory.create();
      const species = await TreeSpecies.create({
        speciesableType: Organisation.LARAVEL_TYPE,
        speciesableId: org.id,
        collection: "historical-tree-species",
        name: "Oak",
        hidden: false
      });

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["treeSpeciesHistorical"] };

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      const speciesResource = document.included.find(r => r.id === species.uuid);
      expect(speciesResource).toBeDefined();
    });

    it("should handle empty sideloads gracefully", async () => {
      const org = await OrganisationFactory.create();
      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = { sideloads: ["financialCollection", "media"] };

      await service.processSideloads(document, org, query);

      expect(document.included).toHaveLength(0);
    });

    it("should process multiple sideloads together", async () => {
      const org = await OrganisationFactory.create();
      const indicator = await FinancialIndicatorFactory.org(org).create();
      const report = await FinancialReportFactory.org(org).create();
      const media = await MediaFactory.org(org).create({ collectionName: "cover" });

      const document = buildJsonApi(OrganisationFullDto);
      const query: OrganisationShowQueryDto = {
        sideloads: ["financialCollection", "financialReport", "media"]
      };

      mediaService.getUrl.mockImplementation((m: Media, variant?: string) => {
        const suffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${m.id}${suffix}`;
      });

      await service.processSideloads(document, org, query);

      expect(document.included.length).toBeGreaterThan(0);
      expect(document.included.find(r => r.id === indicator.uuid)).toBeDefined();
      expect(document.included.find(r => r.id === report.uuid)).toBeDefined();
      expect(document.included.find(r => r.id === media.uuid)).toBeDefined();
    });
  });
});
