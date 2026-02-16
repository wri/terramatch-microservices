import { OrganisationsController } from "./organisations.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { OrganisationsService } from "./organisations.service";
import { OrganisationCreationService } from "./organisation-creation.service";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import {
  OrganisationFactory,
  FinancialIndicatorFactory,
  FinancialReportFactory,
  MediaFactory,
  UserFactory,
  LeadershipFactory,
  OwnershipStakeFactory
} from "@terramatch-microservices/database/factories";
import {
  Organisation,
  FinancialIndicator,
  FinancialReport,
  Media,
  Leadership,
  OwnershipStake,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { serialize, mockUserId } from "@terramatch-microservices/common/util/testing";
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
  let emailQueue: DeepMocked<Queue>;

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
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    controller = module.get(OrganisationsController);

    emailQueue.add = jest.fn().mockResolvedValue({} as Job);
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

    it("should include leadership when sideloads includes leadership", async () => {
      const org = await OrganisationFactory.create();
      const leadership1 = await LeadershipFactory.org(org).create({
        collection: "leadership-team"
      });
      const leadership2 = await LeadershipFactory.org(org).create({
        collection: "core-team-leaders"
      });

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([leadership1, leadership2]);
      const organisationSpy = jest.spyOn(Leadership, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof Leadership);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["leadership"] }));

      expect(Leadership.organisation).toHaveBeenCalledWith(org.id);
      expect(mockFindAll).toHaveBeenCalled();

      const included = result.included ?? [];
      const leadershipResources = included.filter((resource: Resource) => resource.type === "leaderships");
      expect(leadershipResources).toHaveLength(2);
      expect(leadershipResources.map((r: Resource) => r.id)).toContain(leadership1.uuid);
      expect(leadershipResources.map((r: Resource) => r.id)).toContain(leadership2.uuid);

      organisationSpy.mockRestore();
    });

    it("should handle empty leadership gracefully", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([]);
      const organisationSpy = jest.spyOn(Leadership, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof Leadership);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["leadership"] }));

      expect(Leadership.organisation).toHaveBeenCalledWith(org.id);
      expect(mockFindAll).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);

      organisationSpy.mockRestore();
    });

    it("should include ownership stakes when sideloads includes ownershipStakes", async () => {
      const org = await OrganisationFactory.create();
      const stake1 = await OwnershipStakeFactory.org(org).create();
      const stake2 = await OwnershipStakeFactory.org(org).create();

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([stake1, stake2]);
      const organisationSpy = jest.spyOn(OwnershipStake, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof OwnershipStake);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["ownershipStakes"] }));

      expect(OwnershipStake.organisation).toHaveBeenCalledWith(org.uuid);
      expect(mockFindAll).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(2);

      const stakeResources = included.filter((resource: Resource) => resource.type === "ownershipStakes");
      expect(stakeResources).toHaveLength(2);
      expect(stakeResources.map((r: Resource) => r.id)).toContain(stake1.uuid);
      expect(stakeResources.map((r: Resource) => r.id)).toContain(stake2.uuid);

      organisationSpy.mockRestore();
    });

    it("should handle empty ownership stakes gracefully", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFindAll = jest.fn().mockResolvedValue([]);
      const organisationSpy = jest.spyOn(OwnershipStake, "organisation").mockReturnValue({
        findAll: mockFindAll
      } as unknown as typeof OwnershipStake);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["ownershipStakes"] }));

      expect(OwnershipStake.organisation).toHaveBeenCalledWith(org.uuid);
      expect(mockFindAll).toHaveBeenCalled();
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);

      organisationSpy.mockRestore();
    });

    it("should include tree species historical when sideloads includes treeSpeciesHistorical", async () => {
      const org = await OrganisationFactory.create();
      const species1 = await TreeSpecies.create({
        speciesableType: Organisation.LARAVEL_TYPE,
        speciesableId: org.id,
        collection: "historical-tree-species",
        name: "Oak",
        hidden: false
      });
      const species2 = await TreeSpecies.create({
        speciesableType: Organisation.LARAVEL_TYPE,
        speciesableId: org.id,
        collection: "historical-tree-species",
        name: "Pine",
        hidden: false
      });

      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFor = jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          findAll: jest.fn().mockResolvedValue([species1, species2])
        })
      });
      const forSpy = jest.spyOn(TreeSpecies, "for").mockImplementation(mockFor);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["treeSpeciesHistorical"] }));

      expect(TreeSpecies.for).toHaveBeenCalledWith(org);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(2);

      const speciesResources = included.filter((resource: Resource) => resource.type === "treeSpecies");
      expect(speciesResources).toHaveLength(2);
      expect(speciesResources.map((r: Resource) => r.id)).toContain(species1.uuid);
      expect(speciesResources.map((r: Resource) => r.id)).toContain(species2.uuid);

      forSpy.mockRestore();
    });

    it("should handle empty tree species historical gracefully", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const mockFor = jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          findAll: jest.fn().mockResolvedValue([])
        })
      });
      const forSpy = jest.spyOn(TreeSpecies, "for").mockImplementation(mockFor);

      const result = serialize(await controller.show(org.uuid, { sideloads: ["treeSpeciesHistorical"] }));

      expect(TreeSpecies.for).toHaveBeenCalledWith(org);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
      const included = result.included ?? [];
      expect(included).toHaveLength(0);

      forSpy.mockRestore();
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
      const leadership1 = await LeadershipFactory.org(org).create({
        collection: "leadership-team"
      });
      const leadership2 = await LeadershipFactory.org(org).create({
        collection: "core-team-leaders"
      });
      const ownershipStake = await OwnershipStakeFactory.org(org).create();
      const treeSpecies = await TreeSpecies.create({
        speciesableType: Organisation.LARAVEL_TYPE,
        speciesableId: org.id,
        collection: "historical-tree-species",
        name: "Oak",
        hidden: false
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

      const mockLeadershipFindAll = jest.fn().mockResolvedValue([leadership1, leadership2]);
      const leadershipSpy = jest.spyOn(Leadership, "organisation").mockReturnValue({
        findAll: mockLeadershipFindAll
      } as unknown as typeof Leadership);

      const mockOwnershipStakeFindAll = jest.fn().mockResolvedValue([ownershipStake]);
      const ownershipStakeSpy = jest.spyOn(OwnershipStake, "organisation").mockReturnValue({
        findAll: mockOwnershipStakeFindAll
      } as unknown as typeof OwnershipStake);

      const mockFor = jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          findAll: jest.fn().mockResolvedValue([treeSpecies])
        })
      });
      const forSpy = jest.spyOn(TreeSpecies, "for").mockImplementation(mockFor);

      mediaService.getUrl.mockImplementation((media: Media, variant?: string) => {
        const variantSuffix = variant != null && variant !== "" ? `-${variant}` : "";
        return `https://example.com/media/${media.id}${variantSuffix}`;
      });

      const result = serialize(
        await controller.show(org.uuid, {
          sideloads: [
            "financialCollection",
            "financialReport",
            "media",
            "leadership",
            "ownershipStakes",
            "treeSpeciesHistorical"
          ]
        })
      );

      expect(FinancialIndicator.organisation).toHaveBeenCalledWith(org.id);
      expect(FinancialReport.organisation).toHaveBeenCalledWith(org.id);
      expect(Media.for).toHaveBeenCalledTimes(2);
      expect(Leadership.organisation).toHaveBeenCalledWith(org.id);
      expect(OwnershipStake.organisation).toHaveBeenCalledWith(org.uuid);
      expect(TreeSpecies.for).toHaveBeenCalledWith(org);

      const included = result.included ?? [];
      const financialIndicatorResources = included.filter(
        (resource: Resource) => resource.type === "financialIndicators"
      );
      const financialReportResources = included.filter((resource: Resource) => resource.type === "financialReports");
      const mediaResources = included.filter((resource: Resource) => resource.type === "media");
      const leadershipResources = included.filter((resource: Resource) => resource.type === "leaderships");
      const ownershipStakeResources = included.filter((resource: Resource) => resource.type === "ownershipStakes");
      const treeSpeciesResources = included.filter((resource: Resource) => resource.type === "treeSpecies");

      expect(financialIndicatorResources).toHaveLength(1);
      expect(financialReportResources).toHaveLength(1);
      expect(mediaResources).toHaveLength(2);
      expect(leadershipResources).toHaveLength(2);
      expect(ownershipStakeResources).toHaveLength(1);
      expect(treeSpeciesResources).toHaveLength(1);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(coverMedia.uuid);
      expect(mediaResources.map((r: Resource) => r.id)).toContain(logoMedia.uuid);
      expect(leadershipResources.map((r: Resource) => r.id)).toContain(leadership1.uuid);
      expect(leadershipResources.map((r: Resource) => r.id)).toContain(leadership2.uuid);
      expect(ownershipStakeResources.map((r: Resource) => r.id)).toContain(ownershipStake.uuid);
      expect(treeSpeciesResources.map((r: Resource) => r.id)).toContain(treeSpecies.uuid);

      indicatorSpy.mockRestore();
      reportSpy.mockRestore();
      mediaForSpy.mockRestore();
      leadershipSpy.mockRestore();
      ownershipStakeSpy.mockRestore();
      forSpy.mockRestore();
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

    it("should use approveReject authorization when status changes to approved", async () => {
      const org = await OrganisationFactory.create({ status: "pending" });
      const updateAttrs: OrganisationUpdateAttributes = { status: "approved" };
      const updatedOrg = { ...org, status: "approved" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);
      mockUserId(123);

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      await controller.update(org.uuid, updatePayload);

      expect(policyService.authorize).toHaveBeenCalledWith("approveReject", org);
      expect(emailQueue.add).toHaveBeenCalledWith("organisationApproved", {
        organisationId: org.id,
        approvedByUserId: 123
      });
    });

    it("should use approveReject authorization when status changes to rejected", async () => {
      const org = await OrganisationFactory.create({ status: "pending" });
      const updateAttrs: OrganisationUpdateAttributes = { status: "rejected" };
      const updatedOrg = { ...org, status: "rejected" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);
      mockUserId(123);

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      await controller.update(org.uuid, updatePayload);

      expect(policyService.authorize).toHaveBeenCalledWith("approveReject", org);
      expect(emailQueue.add).toHaveBeenCalledWith("organisationRejected", {
        organisationId: org.id,
        rejectedByUserId: 123
      });
    });

    it("should use update authorization when status changes to non-approved/rejected", async () => {
      const org = await OrganisationFactory.create({ status: "approved" });
      const updateAttrs: OrganisationUpdateAttributes = { status: "pending" };
      const updatedOrg = { ...org, status: "pending" };

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

      await controller.update(org.uuid, updatePayload);

      expect(policyService.authorize).toHaveBeenCalledWith("update", org);
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it("should not queue email if status does not change", async () => {
      const org = await OrganisationFactory.create({ status: "approved" });
      const updateAttrs: OrganisationUpdateAttributes = { status: "approved" };
      const updatedOrg = { ...org, status: "approved" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);
      mockUserId(123);

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      await controller.update(org.uuid, updatePayload);

      expect(policyService.authorize).toHaveBeenCalledWith("approveReject", org);
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it("should not queue email if userId is null", async () => {
      const org = await OrganisationFactory.create({ status: "pending" });
      const updateAttrs: OrganisationUpdateAttributes = { status: "approved" };
      const updatedOrg = { ...org, status: "approved" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);
      mockUserId(undefined);

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      await controller.update(org.uuid, updatePayload);

      expect(policyService.authorize).toHaveBeenCalledWith("approveReject", org);
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it("should handle email queueing errors gracefully", async () => {
      const org = await OrganisationFactory.create({ status: "pending" });
      const updateAttrs: OrganisationUpdateAttributes = { status: "approved" };
      const updatedOrg = { ...org, status: "approved" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);
      mockUserId(123);
      emailQueue.add.mockRejectedValue(new Error("Queue error"));

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      await expect(controller.update(org.uuid, updatePayload)).resolves.toBeDefined();
      expect(emailQueue.add).toHaveBeenCalled();
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
