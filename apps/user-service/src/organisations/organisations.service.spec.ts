import { OrganisationsService } from "./organisations.service";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import { faker } from "@faker-js/faker";
import { OrganisationFactory, UserFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { Organisation } from "@terramatch-microservices/database/entities";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";

describe("OrganisationsService", () => {
  let service: OrganisationsService;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: getQueueToken("email"), useValue: {} },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    service = await module.resolve(OrganisationsService);
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
});
