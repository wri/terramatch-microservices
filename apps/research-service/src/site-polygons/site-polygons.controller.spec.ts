/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SitePolygonsController } from "./site-polygons.controller";
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
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
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Site, DelayedJob } from "@terramatch-microservices/database/entities";
import { SiteFactory } from "@terramatch-microservices/database/factories";
import { GeometryUploadRequestDto } from "./dto/geometry-upload.dto";
import { NotFoundException } from "@nestjs/common";
import { FeatureCollection } from "geojson";
import { Job } from "bullmq";

describe("SitePolygonsController", () => {
  let controller: SitePolygonsController;
  let sitePolygonService: DeepMocked<SitePolygonsService>;
  let policyService: DeepMocked<PolicyService>;
  let sitePolygonCreationService: DeepMocked<SitePolygonCreationService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let polygonGeometryService: DeepMocked<PolygonGeometryCreationService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let duplicateGeometryValidator: DeepMocked<DuplicateGeometryValidator>;
  let geometryFileProcessingService: DeepMocked<GeometryFileProcessingService>;
  let geometryUploadQueue: DeepMocked<Queue>;

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
          provide: PolygonGeometryCreationService,
          useValue: (polygonGeometryService = createMock<PolygonGeometryCreationService>())
        },
        {
          provide: DuplicateGeometryValidator,
          useValue: (duplicateGeometryValidator = createMock<DuplicateGeometryValidator>())
        },
        {
          provide: GeometryFileProcessingService,
          useValue: (geometryFileProcessingService = createMock<GeometryFileProcessingService>())
        },
        {
          provide: getQueueToken("geometry-upload"),
          useValue: (geometryUploadQueue = createMock<Queue>())
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

    it("should throw NotFoundException when site polygon is not found", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);
      policyService.authorize.mockResolvedValue(undefined);

      await expect(controller.deleteOne("non-existent-uuid")).rejects.toThrow(NotFoundException);
      expect(policyService.authorize).not.toHaveBeenCalled();
      expect(sitePolygonService.deleteSitePolygon).not.toHaveBeenCalled();
    });
  });

  describe("uploadGeometryFile", () => {
    beforeEach(() => {
      Object.defineProperty(policyService, "userId", {
        value: 1,
        writable: true,
        configurable: true
      });
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const file = { originalname: "test.geojson", buffer: Buffer.from("{}") } as Express.Multer.File;
      const payload = { data: { type: "geometryUpload", attributes: { siteId: "site-uuid" } } };

      await expect(controller.uploadGeometryFile(file, payload as GeometryUploadRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });
      const file = { originalname: "test.geojson", buffer: Buffer.from("{}") } as Express.Multer.File;
      const payload = { data: { type: "geometryUpload", attributes: { siteId: "site-uuid" } } };

      await expect(controller.uploadGeometryFile(file, payload as GeometryUploadRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw NotFoundException when site is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      jest.spyOn(Site, "findOne").mockResolvedValue(null);
      const file = { originalname: "test.geojson", buffer: Buffer.from("{}") } as Express.Multer.File;
      const payload = { data: { type: "geometryUpload", attributes: { siteId: "non-existent-uuid" } } };

      await expect(controller.uploadGeometryFile(file, payload as GeometryUploadRequestDto)).rejects.toThrow(
        NotFoundException
      );
      expect(geometryFileProcessingService.parseGeometryFile).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when file parsing fails", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const site = await SiteFactory.build({ uuid: "site-uuid", name: "Test Site" });
      jest.spyOn(Site, "findOne").mockResolvedValue(site);
      const user = await UserFactory.build();
      user.getSourceFromRoles = jest.fn().mockReturnValue("terramatch");
      jest.spyOn(User, "findByPk").mockResolvedValue(user);

      const file = { originalname: "test.geojson", buffer: Buffer.from("{}") } as Express.Multer.File;
      const payload = { data: { type: "geometryUpload", attributes: { siteId: "site-uuid" } } };

      geometryFileProcessingService.parseGeometryFile.mockRejectedValue(
        new BadRequestException("Failed to parse file")
      );

      await expect(controller.uploadGeometryFile(file, payload as GeometryUploadRequestDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should successfully upload geometry file and create delayed job", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const site = await SiteFactory.build({ uuid: "site-uuid", name: "Test Site" });
      jest.spyOn(Site, "findOne").mockResolvedValue(site);
      const user = await UserFactory.build({ firstName: "Test", lastName: "User" });
      user.getSourceFromRoles = jest.fn().mockReturnValue("terramatch");
      jest.spyOn(User, "findByPk").mockResolvedValue(user);

      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0]
                ]
              ]
            },
            properties: {}
          }
        ]
      };
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(geojson);

      const delayedJob = {
        id: 1,
        uuid: "job-uuid",
        isAcknowledged: false,
        name: "Geometry Upload",
        totalContent: 1,
        processedContent: 0,
        progressMessage: "Parsing geometry file...",
        createdBy: 1
      } as DelayedJob;
      jest.spyOn(DelayedJob, "create").mockResolvedValue(delayedJob);
      geometryUploadQueue.add.mockResolvedValue({} as Job);

      const file = { originalname: "test.geojson", buffer: Buffer.from("{}") } as Express.Multer.File;
      const payload = { data: { type: "geometryUpload", attributes: { siteId: "site-uuid" } } };

      const result = await controller.uploadGeometryFile(file, payload as GeometryUploadRequestDto);

      expect(geometryFileProcessingService.parseGeometryFile).toHaveBeenCalledWith(file);
      expect(DelayedJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Geometry Upload",
          totalContent: 1,
          processedContent: 0,
          progressMessage: "Parsing geometry file...",
          createdBy: 1,
          metadata: {
            entity_id: site.id,
            entity_type: "App\\Models\\V2\\Sites\\Site",
            entity_name: "Test Site"
          }
        })
      );
      expect(geometryUploadQueue.add).toHaveBeenCalledWith("geometryUpload", {
        delayedJobId: 1,
        siteId: "site-uuid",
        geojson,
        userId: 1,
        source: "terramatch",
        userFullName: "Test User"
      });
      const serialized = serialize(result);
      expect(serialized.data).toBeDefined();
      if (Array.isArray(serialized.data)) {
        expect(serialized.data[0].id).toBe("job-uuid");
      } else if (serialized.data != null) {
        expect(serialized.data.id).toBe("job-uuid");
      }
    });

    it("should handle user with null fullName", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const site = await SiteFactory.build({ uuid: "site-uuid", name: "Test Site" });
      jest.spyOn(Site, "findOne").mockResolvedValue(site);
      const user = await UserFactory.build({ firstName: null, lastName: null });
      user.getSourceFromRoles = jest.fn().mockReturnValue("terramatch");
      jest.spyOn(User, "findByPk").mockResolvedValue(user);

      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0]
                ]
              ]
            },
            properties: {}
          }
        ]
      };
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(geojson);

      const delayedJob = {
        id: 1,
        uuid: "job-uuid",
        isAcknowledged: false,
        name: "Geometry Upload",
        totalContent: 1,
        processedContent: 0,
        progressMessage: "Parsing geometry file...",
        createdBy: 1
      } as DelayedJob;
      jest.spyOn(DelayedJob, "create").mockResolvedValue(delayedJob);
      geometryUploadQueue.add.mockResolvedValue({} as Job);

      const file = { originalname: "test.geojson", buffer: Buffer.from("{}") } as Express.Multer.File;
      const payload = { data: { type: "geometryUpload", attributes: { siteId: "site-uuid" } } };

      await controller.uploadGeometryFile(file, payload as GeometryUploadRequestDto);

      expect(geometryUploadQueue.add).toHaveBeenCalledWith("geometryUpload", {
        delayedJobId: 1,
        siteId: "site-uuid",
        geojson,
        userId: 1,
        source: "terramatch",
        userFullName: null
      });
    });
  });
});
