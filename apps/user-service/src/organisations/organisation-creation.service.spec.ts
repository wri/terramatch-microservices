import { OrganisationsService } from "./organisations.service";
import { createMock } from "@golevelup/ts-jest";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { faker } from "@faker-js/faker";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
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

describe("OrganisationsService - create (organisation-creation)", () => {
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
      expect(organisation.currency).toBe("USD");

      await user.reload();
      expect(user.organisationId).toBe(organisation.id);
    });
  });
});
