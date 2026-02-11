import { OrganisationsService } from "./organisations.service";
import { createMock } from "@golevelup/ts-jest";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import { faker } from "@faker-js/faker";
import { OrganisationFactory, UserFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { Organisation } from "@terramatch-microservices/database/entities";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { pick } from "lodash";

const createAttributes = (): OrganisationCreateAttributes => ({
  name: faker.company.name(),
  type: "non-profit-organization",
  hqStreet1: faker.location.streetAddress(),
  hqCity: faker.location.city(),
  hqState: faker.location.state(),
  hqCountry: faker.location.countryCode("alpha-3"),
  phone: faker.phone.number(),
  countries: [faker.location.countryCode("alpha-3")],
  currency: "EUR",
  level0PastRestoration: [faker.location.countryCode("alpha-3")],
  level1PastRestoration: [faker.location.countryCode("alpha-3")]
});

describe("OrganisationsService - create", () => {
  let service: OrganisationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        { provide: getQueueToken("email"), useValue: createMock<Queue>() },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    service = await module.resolve(OrganisationsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("validation", () => {
    it("should throw an error if user is not authenticated", async () => {
      mockUserId(undefined);
      const attributes = createAttributes();
      await expect(service.create(attributes)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw an error if authenticated user is not found", async () => {
      const userId = 99999;
      mockUserId(userId);
      const attributes = createAttributes();
      await expect(service.create(attributes)).rejects.toThrow(NotFoundException);
    });

    it("should throw an error if user already has an organisation", async () => {
      const user = await UserFactory.create();
      const existingOrg = await OrganisationFactory.create();
      await user.update({ organisationId: existingOrg.id });
      mockUserId(user.id);
      const attributes = createAttributes();
      await expect(service.create(attributes)).rejects.toThrow(ConflictException);
    });

    it("should create an organisation and associate it with the authenticated user", async () => {
      const user = await UserFactory.create({ organisationId: null });
      mockUserId(user.id);
      const attributes = createAttributes();
      attributes.hqStreet2 = faker.location.streetAddress();
      attributes.hqZipcode = faker.location.zipCode();

      const { organisation } = await service.create(attributes);

      expect(organisation).toMatchObject({
        status: "draft",
        private: false,
        isTest: false,
        ...pick(attributes, [
          "name",
          "type",
          "hqStreet1",
          "hqStreet2",
          "hqCity",
          "hqZipcode",
          "hqState",
          "hqCountry",
          "phone",
          "countries",
          "currency",
          "level0PastRestoration",
          "level1PastRestoration"
        ])
      });

      await user.reload();
      expect(user.organisationId).toBe(organisation.id);
    });

    it("should create an organisation with minimal attributes", async () => {
      const user = await UserFactory.create({ organisationId: null });
      mockUserId(user.id);
      const attributes: OrganisationCreateAttributes = {
        name: faker.company.name()
      };

      const { organisation } = await service.create(attributes);

      expect(organisation.name).toBe(attributes.name);
      expect(organisation.status).toBe("draft");
      expect(organisation.private).toBe(false);
      expect(organisation.isTest).toBe(false);
      expect(organisation.currency).toBe("USD"); // default value

      await user.reload();
      expect(user.organisationId).toBe(organisation.id);
    });
  });

  describe("findMany", () => {
    it("should return organisations for admin user", async () => {
      await OrganisationFactory.createMany(2);
      const result = await service.findMany({}, true);

      expect(result.organisations.length).toBeGreaterThanOrEqual(2);
      expect(result.paginationTotal).toBeGreaterThanOrEqual(2);
    });

    it("should throw error if non-admin user is not authenticated", async () => {
      mockUserId(undefined);
      await expect(service.findMany({}, false)).rejects.toThrow(BadRequestException);
    });

    it("should filter organisations by user's orgs and projects for non-admin", async () => {
      const user = await UserFactory.create();
      const org1 = await OrganisationFactory.create();
      const org2 = await OrganisationFactory.create();
      await user.update({ organisationId: org1.id });
      const project = await ProjectFactory.create({ organisationId: org2.id });
      await user.$add("projects", project);

      mockUserId(user.id);
      const result = await service.findMany({}, false);

      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by funding programme UUID", async () => {
      const programmeUuid = faker.string.uuid();
      await service.findMany({ fundingProgrammeUuid: programmeUuid }, true);
    });

    it("should filter by search query", async () => {
      await OrganisationFactory.create({ name: "Test Organisation" });
      const result = await service.findMany({ search: "Test" }, true);
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by status", async () => {
      await OrganisationFactory.create({ status: "pending" });
      const result = await service.findMany({ filter: { status: "pending" } }, true);
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by type", async () => {
      await OrganisationFactory.create({ type: "non-profit-organization" });
      const result = await service.findMany({ filter: { type: "non-profit-organization" } }, true);
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by hqCountry", async () => {
      const country = faker.location.countryCode("alpha-3");
      await OrganisationFactory.create({ hqCountry: country });
      const result = await service.findMany({ filter: { hqCountry: country } }, true);
      expect(result.organisations.length).toBeGreaterThanOrEqual(1);
    });

    it("should sort by valid field", async () => {
      await service.findMany({ sort: { field: "name", direction: "ASC" } }, true);
    });

    it("should sort by mapped field", async () => {
      await service.findMany({ sort: { field: "created_at", direction: "ASC" } }, true);
    });

    it("should handle descending sort", async () => {
      await service.findMany({ sort: { field: "-name" } }, true);
    });

    it("should throw error for invalid sort field", async () => {
      await expect(service.findMany({ sort: { field: "invalidField" } }, true)).rejects.toThrow(BadRequestException);
    });

    it("should allow sorting by id field", async () => {
      await service.findMany({ sort: { field: "id" } }, true);
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
