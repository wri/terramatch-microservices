import { OrganisationsController } from "./organisations.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { OrganisationsService } from "./organisations.service";
import { OrganisationCreationService } from "./organisation-creation.service";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import {
  OrganisationFactory,
  FinancialIndicatorFactory,
  FinancialReportFactory,
  MediaFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { Organisation, FinancialIndicator, FinancialReport, Media } from "@terramatch-microservices/database/entities";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

const createRequest = (attributes: OrganisationCreateAttributes = new OrganisationCreateAttributes()) => ({
  data: { type: "organisations", attributes }
});

describe("OrganisationsController", () => {
  let controller: OrganisationsController;
  let policyService: DeepMocked<PolicyService>;
  let organisationsService: DeepMocked<OrganisationsService>;
  let organisationCreationService: DeepMocked<OrganisationCreationService>;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrganisationsController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: OrganisationsService,
          useValue: (organisationsService = createMock<OrganisationsService>())
        },
        {
          provide: OrganisationCreationService,
          useValue: (organisationCreationService = createMock<OrganisationCreationService>())
        },
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: getQueueToken("email"), useValue: createMock() },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    controller = module.get(OrganisationsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("returns orgs without funding programme filter", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.index({}));

      expect(organisationsService.findMany).toHaveBeenCalledWith({});
      expect(policyService.authorize).toHaveBeenCalledWith("read", orgs);
      expect(result.data).toHaveLength(2);
    });

    it("returns orgs associated with a funding programme", async () => {
      const programmeUuid = "test-programme-uuid";
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.index({ fundingProgrammeUuid: programmeUuid }));

      expect(organisationsService.findMany).toHaveBeenCalledWith({ fundingProgrammeUuid: programmeUuid });
      expect(policyService.authorize).toHaveBeenCalledWith("read", orgs);
      expect(result.data).toHaveLength(2);
      const uuids = (result.data as Resource[]).map(({ id }) => id);
      expect(uuids).toContain(orgs[0].uuid);
      expect(uuids).toContain(orgs[1].uuid);
    });

    it("calls service with query when user has framework permissions", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.authorize.mockResolvedValue(undefined);

      await controller.index({});

      expect(organisationsService.findMany).toHaveBeenCalledWith({});
    });
  });

  describe("create", () => {
    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.create(createRequest())).rejects.toThrow(UnauthorizedException);
    });

    it("should call the organisation creation service and return the organisation and user", async () => {
      const attrs = new OrganisationCreateAttributes();
      attrs.name = "Test Organisation";
      attrs.type = "non-profit-organization";
      attrs.hqStreet1 = "123 Main St";
      attrs.hqCity = "City";
      attrs.hqState = "State";
      attrs.hqCountry = "USA";
      attrs.phone = "1234567890";
      attrs.countries = ["USA"];
      attrs.fundingProgrammeUuid = "test-uuid";
      attrs.userFirstName = "John";
      attrs.userLastName = "Doe";
      attrs.userEmailAddress = "john@example.com";
      attrs.userRole = "project-developer";
      attrs.userLocale = "en-US";

      const org = await OrganisationFactory.create({ name: attrs.name });
      const user = await UserFactory.create({ organisationId: org.id });
      user.myFrameworks = jest.fn().mockResolvedValue([]);
      organisationCreationService.createOrganisation.mockResolvedValue({ user, organisation: org });
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.create(createRequest(attrs)));

      expect(policyService.authorize).toHaveBeenCalledWith("create", Organisation);
      expect(organisationCreationService.createOrganisation).toHaveBeenCalledWith(attrs);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      expect(result.included).toBeDefined();
      const userResource = (result.included as Resource[])?.find(r => r.type === "users");
      expect(userResource).toBeDefined();
      expect(userResource?.id).toBe(user.uuid);
    });
  });

  describe("show", () => {
    it("should return a single organisation by UUID", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.show(org.uuid, {}));

      expect(organisationsService.findOne).toHaveBeenCalledWith(org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", org);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = "non-existent-uuid";
      organisationsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.show(nonExistentUuid, {})).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if policy does not authorize", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.show(org.uuid, {})).rejects.toThrow(UnauthorizedException);
    });

    it("should include financial indicators when sideloads includes financialCollection", async () => {
      const org = await OrganisationFactory.create();
      const financialIndicator1 = await FinancialIndicatorFactory.org(org).create();
      const financialIndicator2 = await FinancialIndicatorFactory.org(org).create();
      const media1 = await MediaFactory.financialIndicator(financialIndicator1).create({
        collectionName: "documentation"
      });
      const media2 = await MediaFactory.financialIndicator(financialIndicator1).create({
        collectionName: "documentation"
      });

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([financialIndicator1, financialIndicator2]);
      const organisationSpy = jest.spyOn(FinancialIndicator, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof FinancialIndicator);

      const mockMediaFindAll = jest.fn().mockResolvedValue([media1, media2]);
      const mediaForSpy = jest.spyOn(Media, "for").mockReturnValue({
        findAll: mockMediaFindAll
      } as unknown as ReturnType<typeof Media.for>);

      mediaService.getUrl.mockImplementation((media: Media, variant?: string) => {
        const variantSuffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${media.id}${variantSuffix}`;
      });

      const result = serialize(await controller.show(org.uuid, { sideloads: ["financialCollection"] }));

      expect(FinancialIndicator.organisation).toHaveBeenCalledWith(org.id);
      expect(mockFindAll).toHaveBeenCalled();
      expect(Media.for).toHaveBeenCalledWith([financialIndicator1, financialIndicator2]);
      expect(mockMediaFindAll).toHaveBeenCalledWith({
        where: { collectionName: "documentation" }
      });
      expect(mediaService.getUrl).toHaveBeenCalledTimes(4); // 2 media × 2 calls (url + thumbUrl)

      const included = result.included ?? [];
      const financialIndicatorResources = included.filter(
        (resource: Resource) => resource.type === "financialIndicators"
      );
      expect(financialIndicatorResources).toHaveLength(2);
      expect(financialIndicatorResources.map((r: Resource) => r.id)).toContain(financialIndicator1.uuid);
      expect(financialIndicatorResources.map((r: Resource) => r.id)).toContain(financialIndicator2.uuid);

      organisationSpy.mockRestore();
      mediaForSpy.mockRestore();
    });

    it("should not include financial indicators when sideloads is not provided", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      jest.restoreAllMocks();

      const result = serialize(await controller.show(org.uuid, {}));

      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);
    });

    it("should handle empty financial indicators gracefully", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([]);
      const organisationSpy = jest.spyOn(FinancialIndicator, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof FinancialIndicator);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["financialCollection"] }));

      expect(FinancialIndicator.organisation).toHaveBeenCalledWith(org.id);
      expect(mockFindAll).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);

      organisationSpy.mockRestore();
    });

    it("should include financial reports when sideloads includes financialReport", async () => {
      const org = await OrganisationFactory.create();
      const financialReport1 = await FinancialReportFactory.org(org).create();
      const financialReport2 = await FinancialReportFactory.org(org).create();

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([financialReport1, financialReport2]);
      const organisationSpy = jest.spyOn(FinancialReport, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof FinancialReport);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["financialReport"] }));

      expect(FinancialReport.organisation).toHaveBeenCalledWith(org.id);
      expect(mockFindAll).toHaveBeenCalled();

      const included = result.included ?? [];
      const financialReportResources = included.filter((resource: Resource) => resource.type === "financialReports");
      expect(financialReportResources).toHaveLength(2);
      expect(financialReportResources.map((r: Resource) => r.id)).toContain(financialReport1.uuid);
      expect(financialReportResources.map((r: Resource) => r.id)).toContain(financialReport2.uuid);

      organisationSpy.mockRestore();
    });

    it("should handle empty financial reports gracefully", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([]);
      const organisationSpy = jest.spyOn(FinancialReport, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof FinancialReport);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["financialReport"] }));

      expect(FinancialReport.organisation).toHaveBeenCalledWith(org.id);
      expect(mockFindAll).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);

      organisationSpy.mockRestore();
    });

    it("should include all media when sideloads includes media", async () => {
      const org = await OrganisationFactory.create();
      const coverMedia = await MediaFactory.org(org).create({
        collectionName: "cover"
      });
      const logoMedia = await MediaFactory.org(org).create({
        collectionName: "logo"
      });
      const additionalMedia = await MediaFactory.org(org).create({
        collectionName: "additional"
      });

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockMediaFindAll = jest.fn().mockResolvedValue([coverMedia, logoMedia, additionalMedia]);
      const mediaForSpy = jest.spyOn(Media, "for").mockReturnValue({
        findAll: mockMediaFindAll
      } as unknown as ReturnType<typeof Media.for>);

      mediaService.getUrl.mockImplementation((media: Media, variant?: string) => {
        const variantSuffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${media.id}${variantSuffix}`;
      });

      const result = serialize(await controller.show(org.uuid, { sideloads: ["media"] }));

      expect(Media.for).toHaveBeenCalledWith(org);
      expect(mockMediaFindAll).toHaveBeenCalledWith();
      expect(mediaService.getUrl).toHaveBeenCalledTimes(6); // 3 media × 2 calls (url + thumbUrl)

      const included = result.included ?? [];
      const mediaResources = included.filter((resource: Resource) => resource.type === "media");
      expect(mediaResources).toHaveLength(3);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(coverMedia.uuid);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(logoMedia.uuid);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(additionalMedia.uuid);

      mediaForSpy.mockRestore();
    });

    it("should handle empty media gracefully", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockMediaFindAll = jest.fn().mockResolvedValue([]);
      const mediaForSpy = jest.spyOn(Media, "for").mockReturnValue({
        findAll: mockMediaFindAll
      } as unknown as ReturnType<typeof Media.for>);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["media"] }));

      expect(Media.for).toHaveBeenCalledWith(org);
      expect(mockMediaFindAll).toHaveBeenCalledWith();
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);

      mediaForSpy.mockRestore();
    });

    it("should support multiple sideloads together", async () => {
      const org = await OrganisationFactory.create();
      const financialIndicator = await FinancialIndicatorFactory.org(org).create();
      const financialReport = await FinancialReportFactory.org(org).create();
      const coverMedia = await MediaFactory.org(org).create({
        collectionName: "cover"
      });
      const logoMedia = await MediaFactory.org(org).create({
        collectionName: "logo"
      });

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockIndicatorFindAll = jest.fn().mockResolvedValue([financialIndicator]);
      const indicatorSpy = jest.spyOn(FinancialIndicator, "organisation").mockReturnValue({
        findAll: mockIndicatorFindAll
      } as unknown as typeof FinancialIndicator);

      const mockReportFindAll = jest.fn().mockResolvedValue([financialReport]);
      const reportSpy = jest.spyOn(FinancialReport, "organisation").mockReturnValue({
        findAll: mockReportFindAll
      } as unknown as typeof FinancialReport);

      const mockMediaFindAll = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([coverMedia, logoMedia]);
      const mediaForSpy = jest.spyOn(Media, "for").mockReturnValue({
        findAll: mockMediaFindAll
      } as unknown as ReturnType<typeof Media.for>);

      mediaService.getUrl.mockImplementation((media: Media, variant?: string) => {
        const variantSuffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${media.id}${variantSuffix}`;
      });

      const result = serialize(
        await controller.show(org.uuid, {
          sideloads: ["financialCollection", "financialReport", "media"]
        })
      );

      expect(FinancialIndicator.organisation).toHaveBeenCalledWith(org.id);
      expect(FinancialReport.organisation).toHaveBeenCalledWith(org.id);
      expect(Media.for).toHaveBeenCalledTimes(2);

      const included = result.included ?? [];
      const financialIndicatorResources = included.filter(
        (resource: Resource) => resource.type === "financialIndicators"
      );
      const financialReportResources = included.filter((resource: Resource) => resource.type === "financialReports");
      const mediaResources = included.filter((resource: Resource) => resource.type === "media");

      expect(financialIndicatorResources).toHaveLength(1);
      expect(financialReportResources).toHaveLength(1);
      expect(mediaResources).toHaveLength(2);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(coverMedia.uuid);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(logoMedia.uuid);

      indicatorSpy.mockRestore();
      reportSpy.mockRestore();
      mediaForSpy.mockRestore();
    });
  });

  describe("update", () => {
    it("should update organisation and return updated organisation", async () => {
      const org = await OrganisationFactory.create();
      const updateAttrs: OrganisationUpdateAttributes = {
        name: "Updated Name",
        status: "pending"
      };
      const updatedOrg = { ...org, name: "Updated Name", status: "pending" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      const result = serialize(await controller.update(org.uuid, updatePayload));

      expect(organisationsService.findOne).toHaveBeenCalledWith(org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("update", org);
      expect(organisationsService.update).toHaveBeenCalledWith(org, updateAttrs);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
    });

    it("should throw BadRequestException if UUID in path does not match payload", async () => {
      const org = await OrganisationFactory.create();
      const updateAttrs: OrganisationUpdateAttributes = { name: "Updated Name" };
      const updatePayload = {
        data: {
          type: "organisations",
          id: "different-uuid",
          attributes: updateAttrs
        }
      };

      await expect(controller.update(org.uuid, updatePayload)).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = "non-existent-uuid";
      organisationsService.findOne.mockRejectedValue(new NotFoundException());

      const updatePayload = {
        data: {
          type: "organisations",
          id: nonExistentUuid,
          attributes: { name: "Updated Name" }
        }
      };

      await expect(controller.update(nonExistentUuid, updatePayload)).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if policy does not authorize", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: { name: "Updated Name" }
        }
      };

      await expect(controller.update(org.uuid, updatePayload)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("delete", () => {
    it("should delete organisation and return deleted response", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.delete.mockResolvedValue(undefined);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.delete(org.uuid));

      expect(organisationsService.findOne).toHaveBeenCalledWith(org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", org);
      expect(organisationsService.delete).toHaveBeenCalledWith(org);
      expect(result.meta).toBeDefined();
      expect((result.meta as { resourceIds?: string[] })?.resourceIds).toContain(org.uuid);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = "non-existent-uuid";
      organisationsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.delete(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if policy does not authorize", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.delete(org.uuid)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("index - additional cases", () => {
    it("should use lightResource when specified", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.index({ lightResource: true }));

      expect(result.data).toHaveLength(2);
    });
  });
});
