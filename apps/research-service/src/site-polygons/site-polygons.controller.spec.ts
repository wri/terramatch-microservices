/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SitePolygonsController } from "./site-polygons.controller";
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";
import { SitePolygon, User } from "@terramatch-microservices/database/entities";
import { SitePolygonFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { SitePolygonBulkUpdateBodyDto } from "./dto/site-polygon-update.dto";
import { CreateSitePolygonJsonApiRequestDto } from "./dto/create-site-polygon-request.dto";
import { Transaction } from "sequelize";
import { SitePolygonFullDto, SitePolygonLightDto } from "./dto/site-polygon.dto";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
import { VersionUpdateRequestDto } from "./dto/version-update.dto";

describe("SitePolygonsController", () => {
  let controller: SitePolygonsController;
  let sitePolygonService: DeepMocked<SitePolygonsService>;
  let policyService: DeepMocked<PolicyService>;
  let sitePolygonCreationService: DeepMocked<SitePolygonCreationService>;
  let versioningService: DeepMocked<SitePolygonVersioningService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let polygonGeometryService: DeepMocked<PolygonGeometryCreationService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let duplicateGeometryValidator: DeepMocked<DuplicateGeometryValidator>;

  const mockQueryBuilder = (executeResult: SitePolygon[] = [], totalResult = 0) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      execute: jest.fn(),
      paginationTotal: jest.fn(),
      hasStatuses: jest.fn().mockReturnThis(),
      modifiedSince: jest.fn().mockReturnThis(),
      isMissingIndicators: jest.fn().mockReturnThis(),
      hasPresentIndicators: jest.fn().mockReturnThis(),
      lightResource: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis()
    };
    builder.filterProjectUuids = jest.fn().mockResolvedValue(builder);
    builder.filterProjectAttributes = jest.fn().mockResolvedValue(builder);
    builder.filterSiteUuids = jest.fn().mockResolvedValue(builder);
    builder.excludeTestProjects = jest.fn().mockResolvedValue(builder);
    builder.filterValidationStatus = jest.fn().mockResolvedValue(builder);
    builder.filterProjectShortNames = jest.fn().mockResolvedValue(builder);
    builder.filterPolygonUuids = jest.fn().mockResolvedValue(builder);

    builder.execute.mockResolvedValue(executeResult);
    builder.paginationTotal.mockResolvedValue(totalResult);
    sitePolygonService.buildQuery.mockResolvedValue(builder);

    return builder;
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SitePolygonsController],
      providers: [
        { provide: SitePolygonsService, useValue: (sitePolygonService = createMock<SitePolygonsService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: SitePolygonCreationService,
          useValue: (sitePolygonCreationService = createMock<SitePolygonCreationService>())
        },
        {
          provide: SitePolygonVersioningService,
          useValue: (versioningService = createMock<SitePolygonVersioningService>())
        },
        {
          provide: PolygonGeometryCreationService,
          useValue: (polygonGeometryService = createMock<PolygonGeometryCreationService>())
        },
        {
          provide: DuplicateGeometryValidator,
          useValue: (duplicateGeometryValidator = createMock<DuplicateGeometryValidator>())
        }
      ]
    }).compile();

    controller = module.get(SitePolygonsController);

    sitePolygonService.buildLightDto.mockImplementation(sitePolygon => {
      return Promise.resolve(new SitePolygonLightDto(sitePolygon, []));
    });

    sitePolygonService.buildFullDto.mockImplementation(sitePolygon => {
      return Promise.resolve(new SitePolygonFullDto(sitePolygon, [], [], []));
    });

    sitePolygonCreationService.createSitePolygons.mockImplementation(async () => ({
      data: [],
      included: []
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findMany", () => {
    it("should should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.findMany({})).rejects.toThrow(UnauthorizedException);
    });

    it("should throw when more than one exclusive query param is provided", async () => {
      const landscape = "gcb" as LandscapeSlug;
      const projectId = ["asdf"];
      const projectCohort = ["pants"];
      const siteId = ["asdf"];
      const cases = [
        { landscape, projectId },
        { landscape, siteId },
        { projectCohort, projectId },
        { projectCohort, siteId },
        { projectId, siteId }
      ];

      for (const query of cases) {
        await expect(controller.findMany(query)).rejects.toThrow(BadRequestException);
      }
    });

    it("should throw an error if presentIndicator and missingIndicator are both provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      await expect(
        controller.findMany({
          siteId: ["123"],
          presentIndicator: ["treeCoverLoss"],
          missingIndicator: ["treeCover"]
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw an error if the page size is invalid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      await expect(controller.findMany({ page: { size: 300 } })).rejects.toThrow(BadRequestException);
      await expect(controller.findMany({ page: { size: -1 } })).rejects.toThrow(BadRequestException);
    });

    it("should throw an error if the page after is invalid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      sitePolygonService.buildQuery.mockRejectedValue(new BadRequestException());
      await expect(controller.findMany({ page: { after: "asdfasdf" } })).rejects.toThrow(BadRequestException);
    });

    it("should throw an error if the page number is invalid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      sitePolygonService.buildQuery.mockRejectedValue(new BadRequestException());
      await expect(controller.findMany({ page: { size: 5, number: 0 } })).rejects.toThrow(BadRequestException);
    });

    it("should returns a valid value if the request is valid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const sitePolygon = await SitePolygonFactory.build();
      mockQueryBuilder([sitePolygon], 1);
      const result = serialize(await controller.findMany({}));
      expect(result.meta).not.toBe(null);
      expect(result.meta!.indices?.[0].total).toBe(1);
      expect(result.meta!.indices?.[0].cursor).toBe(sitePolygon.uuid);

      const resources = result.data as Resource[];
      expect(resources.length).toBe(1);
      expect(resources[0].id).toBe(sitePolygon.uuid);
    });

    it("should return a number page document shape if a number page is requested", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const sitePolygon = await SitePolygonFactory.build();
      mockQueryBuilder([sitePolygon], 1);
      const result = serialize(await controller.findMany({ page: { size: 5, number: 1 } }));
      expect(result.meta).not.toBe(null);
      expect(result.meta!.indices?.[0].total).toBe(1);
      expect(result.meta!.indices?.[0].pageNumber).toBe(1);

      const resources = result.data as Resource[];
      expect(resources.length).toBe(1);
      expect(resources[0].id).toBe(sitePolygon.uuid);
    });

    it("should exclude test projects by default", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();
      const result = serialize(await controller.findMany({}));
      expect(result.meta?.indices?.[0].total).toBe(0);

      expect(builder.excludeTestProjects).toHaveBeenCalled();
    });

    it("should honor projectIds, projectCohort, landscape, siteIds, includeTestProjects when provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ projectId: ["asdf"] });
      expect(builder.filterProjectUuids).toHaveBeenCalledWith(["asdf"]);
      expect(builder.excludeTestProjects).not.toHaveBeenCalled();
      builder.filterProjectUuids.mockClear();

      await controller.findMany({ projectCohort: ["pants"] });
      expect(builder.filterProjectAttributes).toHaveBeenCalledWith(["pants"], undefined);
      expect(builder.excludeTestProjects).toHaveBeenCalled();
      builder.excludeTestProjects.mockClear();
      builder.filterProjectAttributes.mockClear();

      await controller.findMany({ landscape: "gcb" });
      expect(builder.filterProjectAttributes).toHaveBeenCalledWith(undefined, "gcb");
      expect(builder.excludeTestProjects).toHaveBeenCalled();
      builder.excludeTestProjects.mockClear();
      builder.filterProjectAttributes.mockClear();

      await controller.findMany({ projectCohort: ["shirts"], landscape: "ikr" });
      expect(builder.filterProjectAttributes).toHaveBeenCalledWith(["shirts"], "ikr");
      expect(builder.excludeTestProjects).toHaveBeenCalled();
      builder.excludeTestProjects.mockClear();
      builder.filterProjectAttributes.mockClear();

      await controller.findMany({ includeTestProjects: true });
      expect(builder.filterProjectUuids).not.toHaveBeenCalled();
      expect(builder.excludeTestProjects).not.toHaveBeenCalled();

      await controller.findMany({});
      expect(builder.filterProjectUuids).not.toHaveBeenCalled();
      expect(builder.excludeTestProjects).toHaveBeenCalled();

      await controller.findMany({ siteId: ["asdf"] });
      expect(builder.filterSiteUuids).toHaveBeenCalledWith(["asdf"]);
    });

    it("should call filterValidationStatus when validationStatus is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();
      builder.filterValidationStatus = jest.fn().mockResolvedValue(builder);

      await controller.findMany({ validationStatus: ["passed", "not_checked"] });
      expect(builder.filterValidationStatus).toHaveBeenCalledWith(["passed", "not_checked"]);
    });

    it("should execute real filterValidationStatus logic", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const poly1 = await SitePolygonFactory.create({ validationStatus: "passed" });
      const poly2 = await SitePolygonFactory.create({ validationStatus: null });

      mockQueryBuilder([poly1, poly2], 2);

      const result = serialize(
        await controller.findMany({
          validationStatus: ["passed", "not_checked"],
          page: { size: 10, number: 1 }
        })
      );
      expect(result.data).toHaveLength(2);
    });
    it("should throw BadRequestException when lightResource is true and pagination is not number-based", async () => {
      const query = {
        lightResource: true,
        page: { after: "cursor" }
      };

      await expect(controller.findMany(query)).rejects.toThrow(BadRequestException);
    });

    it("should call addSearch when search parameter is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();
      builder.addSearch = jest.fn().mockResolvedValue(builder);

      const searchTerm = "forest site";
      await controller.findMany({ search: searchTerm });

      expect(builder.addSearch).toHaveBeenCalledWith(searchTerm);
    });

    it("should apply sorting when sort is provided with number pagination", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ page: { size: 10, number: 1 }, sort: { field: "name", direction: "DESC" } });

      expect(builder.order).toHaveBeenCalledWith(["polyName", "DESC"]);
    });

    it("should apply sorting by status with number pagination", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ page: { size: 10, number: 1 }, sort: { field: "status", direction: "ASC" } });

      expect(builder.order).toHaveBeenCalledWith(["status", "ASC"]);
    });

    it("should apply sorting by createdAt with number pagination", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ page: { size: 10, number: 1 }, sort: { field: "createdAt", direction: "DESC" } });

      expect(builder.order).toHaveBeenCalledWith(["createdAt", "DESC"]);
    });

    it("should call isMissingIndicators when missingIndicator is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ missingIndicator: ["treeCover"] });

      expect(builder.isMissingIndicators).toHaveBeenCalledWith(["treeCover"]);
      expect(builder.hasPresentIndicators).not.toHaveBeenCalled();
    });

    it("should call hasPresentIndicators when presentIndicator is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ presentIndicator: ["treeCoverLoss"] });

      expect(builder.hasPresentIndicators).toHaveBeenCalledWith(["treeCoverLoss"]);
      expect(builder.isMissingIndicators).not.toHaveBeenCalled();
    });

    it("should call filterProjectShortNames when projectShortNames is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ projectShortNames: ["ABC", "DEF"] });

      expect(builder.filterProjectShortNames).toHaveBeenCalledWith(["ABC", "DEF"]);
    });

    it("should call filterPolygonUuids when polygonUuid is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ polygonUuid: ["uuid-1", "uuid-2"] });

      expect(builder.filterPolygonUuids).toHaveBeenCalledWith(["uuid-1", "uuid-2"]);
    });

    it("should throw when sorting without number pagination", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      mockQueryBuilder();

      await expect(
        controller.findMany({ page: { after: "cursor" }, sort: { field: "name", direction: "ASC" } })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw when sort field is invalid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      mockQueryBuilder();

      await expect(
        controller.findMany({ page: { size: 10, number: 1 }, sort: { field: "invalid", direction: "ASC" } })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("create", () => {
    beforeEach(() => {
      Object.defineProperty(policyService, "userId", {
        value: 1,
        writable: true,
        configurable: true
      });
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });
      const request = { data: { type: "sitePolygons", attributes: { geometries: [] } } };

      await expect(controller.create(request as CreateSitePolygonJsonApiRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should create site polygons with JSON:API format", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const user = await UserFactory.build({ firstName: "Test", lastName: "User" });
      user.getSourceFromRoles = jest.fn().mockReturnValue("terramatch");
      jest.spyOn(User, "findByPk").mockResolvedValue(user);

      const sitePolygon = await SitePolygonFactory.build();
      sitePolygonCreationService.createSitePolygons.mockResolvedValue({
        data: [sitePolygon],
        included: []
      });
      sitePolygonService.loadAssociationDtos.mockResolvedValue({});
      sitePolygonService.buildLightDto.mockResolvedValue(new SitePolygonLightDto(sitePolygon, []));

      const geometries = [{ type: "FeatureCollection", features: [] }];
      const request = { data: { type: "sitePolygons", attributes: { geometries } } };

      const result = await controller.create(request as CreateSitePolygonJsonApiRequestDto);

      expect(User.findByPk).toHaveBeenCalledWith(1, {
        include: [{ association: "roles", attributes: ["name"] }]
      });
      expect(sitePolygonCreationService.createSitePolygons).toHaveBeenCalledWith(
        { geometries },
        1,
        "terramatch",
        "Test User"
      );
      expect(result.data).toBeDefined();
    });

    it("should include validations in response when present", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const user = await UserFactory.build({ firstName: "Test", lastName: "User" });
      user.getSourceFromRoles = jest.fn().mockReturnValue("terramatch");
      jest.spyOn(User, "findByPk").mockResolvedValue(user);

      const sitePolygon = await SitePolygonFactory.build();
      const validation = {
        type: "validation" as const,
        id: "validation-123",
        attributes: {
          polygonUuid: sitePolygon.uuid,
          criteriaList: []
        }
      };
      sitePolygonCreationService.createSitePolygons.mockResolvedValue({
        data: [sitePolygon],
        included: [validation]
      });
      sitePolygonService.loadAssociationDtos.mockResolvedValue({});
      sitePolygonService.buildLightDto.mockResolvedValue(new SitePolygonLightDto(sitePolygon, []));

      const geometries = [{ type: "FeatureCollection", features: [] }];
      const request = { data: { type: "sitePolygons", attributes: { geometries } } };

      const result = await controller.create(request as CreateSitePolygonJsonApiRequestDto);

      expect(result.data).toBeDefined();
    });
  });

  describe("bulkUpdate", () => {
    it("Should authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.bulkUpdate({} as SitePolygonBulkUpdateBodyDto)).rejects.toThrow(UnauthorizedException);
    });

    it("should use a transaction for updates", async () => {
      const transaction = {} as Transaction;
      sitePolygonService.updateIndicator.mockResolvedValue();
      sitePolygonService.transaction.mockImplementation(callback => callback(transaction));
      const indicator = {
        indicatorSlug: "restorationByLandUse",
        yearOfAnalysis: 2025,
        value: {
          "Northern Acacia-Commiphora bushlands and thickets": 0.114
        }
      };
      const payload = {
        data: [{ type: "sitePolygons", id: "1234", attributes: { indicators: [indicator] } }]
      } as SitePolygonBulkUpdateBodyDto;
      await controller.bulkUpdate(payload);
      expect(sitePolygonService.updateIndicator).toHaveBeenCalledWith("1234", indicator, transaction);
    });

    it("should call update for each indicator in the payload", async () => {
      const transaction = {} as Transaction;
      sitePolygonService.updateIndicator.mockResolvedValue();
      sitePolygonService.transaction.mockImplementation(callback => callback(transaction));
      const indicator1 = {
        indicatorSlug: "restorationByLandUse",
        yearOfAnalysis: 2025,
        value: {
          "Northern Acacia-Commiphora bushlands and thickets": 0.114
        }
      };
      const indicator2 = {
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2025,
        value: {
          "2023": 0.45,
          "2024": 0.6,
          "2025": 0.8
        }
      };
      const payload = {
        data: [
          { type: "sitePolygons", id: "1234", attributes: { indicators: [indicator1, indicator2] } },
          { type: "sitePolygons", id: "2345", attributes: { indicators: [indicator2] } }
        ]
      } as SitePolygonBulkUpdateBodyDto;
      await controller.bulkUpdate(payload);
      expect(sitePolygonService.updateIndicator).toHaveBeenCalledTimes(3);
      expect(sitePolygonService.updateIndicator).toHaveBeenNthCalledWith(1, "1234", indicator1, transaction);
      expect(sitePolygonService.updateIndicator).toHaveBeenNthCalledWith(2, "1234", indicator2, transaction);
      expect(sitePolygonService.updateIndicator).toHaveBeenNthCalledWith(3, "2345", indicator2, transaction);
    });
  });

  describe("deleteOne", () => {
    it("should throw UnauthorizedException when user is not authorized", async () => {
      const sitePolygon = await SitePolygonFactory.build();
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(sitePolygon);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.deleteOne(sitePolygon.uuid)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", sitePolygon);
      expect(sitePolygonService.deleteSitePolygon).not.toHaveBeenCalled();
    });

    it("should successfully delete a site polygon when authorized", async () => {
      const sitePolygon = await SitePolygonFactory.build();
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(sitePolygon);
      policyService.authorize.mockResolvedValue(undefined);
      sitePolygonService.deleteSitePolygon.mockResolvedValue(undefined);

      const result = await controller.deleteOne(sitePolygon.uuid);

      expect(policyService.authorize).toHaveBeenCalledWith("delete", sitePolygon);
      expect(sitePolygonService.deleteSitePolygon).toHaveBeenCalledWith(sitePolygon.uuid);
      expect(result).toHaveProperty("meta");
      expect(result.meta).toHaveProperty("resourceType", "sitePolygons");
      expect(result.meta).toHaveProperty("resourceIds", [sitePolygon.uuid]);
    });
  });

  describe("getVersions", () => {
    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.getVersions("test-uuid")).rejects.toThrow(UnauthorizedException);
    });

    it("should throw NotFoundException when polygon is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      await expect(controller.getVersions("non-existent-uuid")).rejects.toThrow(NotFoundException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", SitePolygon);
    });

    it("should return all versions ordered by creation date", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      const primaryUuid = "primary-uuid-123";
      const polygon = await SitePolygonFactory.build({ uuid: "polygon-uuid", primaryUuid });
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(polygon);

      const version1 = await SitePolygonFactory.build({
        uuid: "version-1-uuid",
        primaryUuid,
        createdAt: new Date("2024-01-01")
      });
      const version2 = await SitePolygonFactory.build({
        uuid: "version-2-uuid",
        primaryUuid,
        createdAt: new Date("2024-01-02")
      });
      const versions = [version2, version1];

      versioningService.getVersionHistory.mockResolvedValue(versions);
      sitePolygonService.loadAssociationDtos.mockResolvedValue({
        [version1.id]: {},
        [version2.id]: {}
      });
      sitePolygonService.buildLightDto.mockImplementation(sitePolygon => {
        return Promise.resolve(new SitePolygonLightDto(sitePolygon, []));
      });

      const result = await controller.getVersions("polygon-uuid");

      expect(policyService.authorize).toHaveBeenCalledWith("read", SitePolygon);
      expect(SitePolygon.findOne).toHaveBeenCalledWith({ where: { uuid: "polygon-uuid" } });
      expect(versioningService.getVersionHistory).toHaveBeenCalledWith(primaryUuid);
      expect(sitePolygonService.loadAssociationDtos).toHaveBeenCalledWith(versions, false);
      expect(result.data).toBeDefined();
    });
  });

  describe("updateVersion", () => {
    let originalSequelize: typeof SitePolygon.sequelize;

    beforeEach(() => {
      originalSequelize = SitePolygon.sequelize;
      Object.defineProperty(policyService, "userId", {
        value: 1,
        writable: true,
        configurable: true
      });
    });

    afterEach(() => {
      if (SitePolygon.sequelize !== originalSequelize) {
        Object.defineProperty(SitePolygon, "sequelize", {
          value: originalSequelize,
          writable: true,
          configurable: true
        });
      }
    });

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true
          }
        }
      };

      await expect(controller.updateVersion("test-uuid", request)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });
      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true
          }
        }
      };

      await expect(controller.updateVersion("test-uuid", request)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException when isActive is not true", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: false
          }
        }
      };

      await expect(controller.updateVersion("test-uuid", request)).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when database connection is not available", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(SitePolygon, "sequelize", {
        value: null,
        writable: true,
        configurable: true
      });
      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true
          }
        }
      };

      await expect(controller.updateVersion("test-uuid", request)).rejects.toThrow(BadRequestException);
    });

    it("should successfully activate version without comment", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      const activatedVersion = await SitePolygonFactory.build({
        uuid: "version-uuid",
        primaryUuid: "primary-uuid",
        versionName: "Test Version",
        isActive: true
      });

      const mockTransaction = {} as Transaction;
      const mockSequelize = {
        transaction: jest.fn().mockImplementation(callback => Promise.resolve(callback(mockTransaction)))
      };
      Object.defineProperty(SitePolygon, "sequelize", {
        value: mockSequelize,
        writable: true,
        configurable: true
      });

      versioningService.activateVersion.mockResolvedValue(activatedVersion);
      sitePolygonService.loadAssociationDtos.mockResolvedValue({
        [activatedVersion.id]: {}
      });
      sitePolygonService.buildLightDto.mockResolvedValue(new SitePolygonLightDto(activatedVersion, []));

      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true
          }
        }
      };

      const result = await controller.updateVersion("version-uuid", request);

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(versioningService.activateVersion).toHaveBeenCalledWith("version-uuid", 1, mockTransaction);
      expect(versioningService.trackChange).not.toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it("should successfully activate version with comment", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      const activatedVersion = await SitePolygonFactory.build({
        uuid: "version-uuid",
        primaryUuid: "primary-uuid",
        versionName: "Test Version",
        isActive: true
      });

      const mockTransaction = {} as Transaction;
      const mockSequelize = {
        transaction: jest.fn().mockImplementation(callback => Promise.resolve(callback(mockTransaction)))
      };
      Object.defineProperty(SitePolygon, "sequelize", {
        value: mockSequelize,
        writable: true,
        configurable: true
      });

      versioningService.activateVersion.mockResolvedValue(activatedVersion);
      versioningService.trackChange.mockResolvedValue();
      sitePolygonService.loadAssociationDtos.mockResolvedValue({
        [activatedVersion.id]: {}
      });
      sitePolygonService.buildLightDto.mockResolvedValue(new SitePolygonLightDto(activatedVersion, []));

      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true,
            comment: "Reverting to previous version"
          }
        }
      };

      const result = await controller.updateVersion("version-uuid", request);

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(versioningService.activateVersion).toHaveBeenCalledWith("version-uuid", 1, mockTransaction);
      expect(versioningService.trackChange).toHaveBeenCalledWith(
        activatedVersion.primaryUuid,
        activatedVersion.versionName ?? "Unknown",
        "Comment: Reverting to previous version",
        1,
        "update",
        undefined,
        undefined,
        mockTransaction
      );
      expect(result.data).toBeDefined();
    });

    it("should not track change when comment is empty string", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      const activatedVersion = await SitePolygonFactory.build({
        uuid: "version-uuid",
        primaryUuid: "primary-uuid",
        versionName: "Test Version",
        isActive: true
      });

      const mockTransaction = {} as Transaction;
      const mockSequelize = {
        transaction: jest.fn().mockImplementation(callback => Promise.resolve(callback(mockTransaction)))
      };
      Object.defineProperty(SitePolygon, "sequelize", {
        value: mockSequelize,
        writable: true,
        configurable: true
      });

      versioningService.activateVersion.mockResolvedValue(activatedVersion);
      sitePolygonService.loadAssociationDtos.mockResolvedValue({
        [activatedVersion.id]: {}
      });
      sitePolygonService.buildLightDto.mockResolvedValue(new SitePolygonLightDto(activatedVersion, []));

      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true,
            comment: ""
          }
        }
      };

      await controller.updateVersion("version-uuid", request);

      expect(versioningService.trackChange).not.toHaveBeenCalled();
    });

    it("should not track change when comment is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      const activatedVersion = await SitePolygonFactory.build({
        uuid: "version-uuid",
        primaryUuid: "primary-uuid",
        versionName: "Test Version",
        isActive: true
      });

      const mockTransaction = {} as Transaction;
      const mockSequelize = {
        transaction: jest.fn().mockImplementation(callback => Promise.resolve(callback(mockTransaction)))
      };
      Object.defineProperty(SitePolygon, "sequelize", {
        value: mockSequelize,
        writable: true,
        configurable: true
      });

      versioningService.activateVersion.mockResolvedValue(activatedVersion);
      sitePolygonService.loadAssociationDtos.mockResolvedValue({
        [activatedVersion.id]: {}
      });
      sitePolygonService.buildLightDto.mockResolvedValue(new SitePolygonLightDto(activatedVersion, []));

      const request: VersionUpdateRequestDto = {
        data: {
          type: "sitePolygons",
          attributes: {
            isActive: true
          }
        }
      };

      await controller.updateVersion("version-uuid", request);

      expect(versioningService.trackChange).not.toHaveBeenCalled();
    });
  });

  describe("deleteVersion", () => {
    it("should throw UnauthorizedException when user is not authorized", async () => {
      const sitePolygon = await SitePolygonFactory.build();
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(sitePolygon);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.deleteVersion(sitePolygon.uuid)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", sitePolygon);
      expect(sitePolygonService.deleteSingleVersion).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when polygon is not found", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);
      policyService.authorize.mockResolvedValue(undefined);

      await expect(controller.deleteVersion("non-existent-uuid")).rejects.toThrow(NotFoundException);
      expect(sitePolygonService.deleteSingleVersion).not.toHaveBeenCalled();
    });

    it("should successfully delete a version when authorized", async () => {
      const sitePolygon = await SitePolygonFactory.build();
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(sitePolygon);
      policyService.authorize.mockResolvedValue(undefined);
      sitePolygonService.deleteSingleVersion.mockResolvedValue(undefined);

      const result = await controller.deleteVersion(sitePolygon.uuid);

      expect(policyService.authorize).toHaveBeenCalledWith("delete", sitePolygon);
      expect(sitePolygonService.deleteSingleVersion).toHaveBeenCalledWith(sitePolygon.uuid);
      expect(result).toHaveProperty("meta");
      expect(result.meta).toHaveProperty("resourceType", "sitePolygons");
      expect(result.meta).toHaveProperty("resourceIds", [sitePolygon.uuid]);
    });
  });
});
