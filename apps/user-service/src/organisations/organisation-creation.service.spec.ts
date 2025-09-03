/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { OrganisationCreationService } from "./organisation-creation.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { faker } from "@faker-js/faker";
import {
  FormFactory,
  FundingProgrammeFactory,
  OrganisationFactory,
  RoleFactory,
  StageFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import {
  Application,
  FormSubmission,
  ModelHasRole,
  Organisation,
  ProjectPitch,
  Role,
  User
} from "@terramatch-microservices/database/entities";
import { pick } from "lodash";

const createAttributes = (fundingProgrammeUuid = faker.string.uuid()): OrganisationCreateAttributes => ({
  name: faker.company.name(),
  type: "non-profit-organization",
  hqStreet1: faker.location.streetAddress(),
  hqCity: faker.location.city(),
  hqState: faker.location.state(),
  hqCountry: faker.location.country(),
  phone: faker.phone.number(),
  countries: [faker.location.countryCode("alpha-3")],
  fundingProgrammeUuid: fundingProgrammeUuid,
  userFirstName: faker.person.firstName(),
  userLastName: faker.person.lastName(),
  userEmailAddress: faker.internet.email(),
  userRole: "project-developer",
  userLocale: "en-US"
});

const validFundingProgramme = async () => {
  const fundingProgramme = await FundingProgrammeFactory.create();
  const stage = await StageFactory.create({ fundingProgrammeId: fundingProgramme.uuid });
  const form = await FormFactory.create({ stageId: stage.uuid });
  return { fundingProgramme, stage, form };
};

describe("OrganisationCreationService", () => {
  let service: OrganisationCreationService;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrganisationCreationService,
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) }
      ]
    }).compile();

    service = module.get(OrganisationCreationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("validation", () => {
    it("should throw an error if the org name is already taken", async () => {
      const attributes = createAttributes();
      await OrganisationFactory.create({ name: attributes.name });
      await expect(service.createOrganisation(attributes)).rejects.toThrow("Organisation already exists");
      await Organisation.truncate();
    });

    it("should throw an error if the funding programme does not exist", async () => {
      const attributes = createAttributes();
      await expect(service.createOrganisation(attributes)).rejects.toThrow("Funding programme not found");
    });

    it("should throw an error if the funding programme has no stages", async () => {
      const attributes = createAttributes((await FundingProgrammeFactory.create()).uuid);
      await expect(service.createOrganisation(attributes)).rejects.toThrow("Funding programme has no stages");
    });

    it("should throw an error if the funding programme does not have a form", async () => {
      const { uuid } = await FundingProgrammeFactory.create();
      await StageFactory.create({ fundingProgrammeId: uuid });
      const attributes = createAttributes(uuid);
      await expect(service.createOrganisation(attributes)).rejects.toThrow("Funding programme first stage has no form");
    });

    it("should throw an error if the user already exists", async () => {
      const user = await UserFactory.create();
      const { fundingProgramme } = await validFundingProgramme();
      const attributes = createAttributes(fundingProgramme.uuid);
      attributes.userEmailAddress = user.emailAddress;
      await expect(service.createOrganisation(attributes)).rejects.toThrow("User already exists");
    });

    it("should throw an error if the user role is invalid", async () => {
      const { fundingProgramme } = await validFundingProgramme();
      const attributes = createAttributes(fundingProgramme.uuid);
      attributes.userRole = "invalid-role";
      await expect(service.createOrganisation(attributes)).rejects.toThrow("User role not found");
    });

    it("should use the attributes to create a valid org, user and send an email", async () => {
      let role = await Role.findOne({ where: { name: "project-developer" } });
      if (role == null) role = await RoleFactory.create({ name: "project-developer" });
      const { fundingProgramme, stage, form } = await validFundingProgramme();
      const attributes = createAttributes(fundingProgramme.uuid);
      // fill in all the optional attributes
      attributes.hqStreet2 = faker.location.streetAddress();
      attributes.hqZipcode = faker.location.zipCode();
      attributes.currency = "EUR";
      attributes.level0Proposed = [faker.location.countryCode("alpha-3"), faker.location.countryCode("alpha-3")];
      attributes.level1Proposed = [faker.location.countryCode("alpha-3")];
      attributes.level0PastRestoration = [faker.location.countryCode("alpha-3")];
      attributes.level1PastRestoration = [faker.location.countryCode("alpha-3"), faker.location.countryCode("alpha-3")];

      // org creation
      const { user, organisation } = await service.createOrganisation(attributes);
      expect(organisation).toMatchObject({
        status: "pending",
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

      // user creation
      expect(user).toMatchObject({
        organisationId: organisation.id,
        emailAddress: attributes.userEmailAddress,
        firstName: attributes.userFirstName,
        lastName: attributes.userLastName,
        locale: attributes.userLocale
      });
      expect(user.emailAddressVerifiedAt).not.toBeNull();
      const modelRole = await ModelHasRole.findOne({ where: { modelType: User.LARAVEL_TYPE, modelId: user.id } });
      expect(modelRole?.roleId).toBe(role.id);

      // pitch, application, form submission creation
      const pitch = await ProjectPitch.findOne({ where: { organisationId: organisation.uuid } });
      expect(pitch).toMatchObject({
        fundingProgrammeId: attributes.fundingProgrammeUuid,
        level0Proposed: attributes.level0Proposed,
        level1Proposed: attributes.level1Proposed
      });
      const application = await Application.findOne({ where: { organisationUuid: organisation.uuid } });
      expect(application).toMatchObject({
        fundingProgrammeUuid: attributes.fundingProgrammeUuid,
        updatedBy: user.id
      });
      const submission = await FormSubmission.findOne({ where: { organisationUuid: organisation.uuid } });
      expect(submission).toMatchObject({
        formId: form.uuid,
        stageUuid: stage.uuid,
        projectPitchUuid: pitch!.uuid,
        applicationId: application!.id,
        status: "started",
        answers: []
      });

      // email queue
      expect(emailQueue.add).toHaveBeenCalledWith("adminUserCreation", {
        userId: user.id,
        fundingProgrammeName: fundingProgramme.name
      });
    });
  });
});
