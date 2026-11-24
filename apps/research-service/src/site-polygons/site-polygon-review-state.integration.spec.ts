import { Test } from "@nestjs/testing";
import { createMock } from "@golevelup/ts-jest";
import { AnrPlotGeometry, CriteriaSite, SitePolygon } from "@terramatch-microservices/database/entities";
import { PolygonGeometryFactory, SitePolygonFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { PolygonStatus } from "@terramatch-microservices/database/constants";
import { EventService } from "@terramatch-microservices/common/events/event.service";
import { GwcTileInvalidationService } from "@terramatch-microservices/common/gwc/gwc-tile-invalidation.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { PolygonAttributeValuesService } from "./polygon-attribute-values.service";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
import { VoronoiService } from "../voronoi/voronoi.service";
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import { BoundingBoxService } from "../bounding-boxes/bounding-box.service";
import { AttributeChangesDto, CreateSitePolygonRequestDto } from "./dto/create-site-polygon-request.dto";

describe("SitePolygonCreationService review state (DB)", () => {
  let service: SitePolygonCreationService;
  let polygonGeometryService: PolygonGeometryCreationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SitePolygonCreationService,
        SitePolygonVersioningService,
        { provide: PolygonGeometryCreationService, useValue: createMock<PolygonGeometryCreationService>() },
        { provide: PointGeometryCreationService, useValue: createMock<PointGeometryCreationService>() },
        { provide: PolygonAttributeValuesService, useValue: createMock<PolygonAttributeValuesService>() },
        { provide: DuplicateGeometryValidator, useValue: createMock<DuplicateGeometryValidator>() },
        { provide: VoronoiService, useValue: createMock<VoronoiService>() },
        { provide: GeometryFileProcessingService, useValue: createMock<GeometryFileProcessingService>() },
        { provide: EventService, useValue: createMock<EventService>() },
        { provide: BoundingBoxService, useValue: createMock<BoundingBoxService>() },
        { provide: GwcTileInvalidationService, useValue: createMock<GwcTileInvalidationService>() }
      ]
    }).compile();

    service = module.get(SitePolygonCreationService);
    polygonGeometryService = module.get(PolygonGeometryCreationService);
  });

  // Mirrors the edit drawer payload: every form field is sent, and an empty tree count is sent as 0.
  const drawerPayload = (polygon: SitePolygon, overrides: AttributeChangesDto): AttributeChangesDto => ({
    polyName: polygon.polyName ?? "",
    plantStart: "2024-01-15T00:00:00.000Z",
    practice: polygon.practice ?? [],
    targetSys: polygon.targetSys ?? "",
    distr: polygon.distr ?? [],
    numTrees: polygon.numTrees ?? 0,
    ...overrides
  });

  const createApprovedPolygonWithPlotsAndCriteria = async () => {
    const user = await UserFactory.create();
    const polygon = await SitePolygonFactory.create({
      status: "approved",
      validationStatus: "passed",
      practice: ["tree-planting", "assisted-natural-regeneration"],
      targetSys: "agroforest",
      distr: ["full"],
      numTrees: null,
      plantStart: new Date("2024-01-15T00:00:00.000Z"),
      createdBy: user.id
    });
    await CriteriaSite.create({ criteriaId: 3, polygonId: polygon.polygonUuid, valid: true } as CriteriaSite);
    await AnrPlotGeometry.create({
      sitePolygonId: polygon.id,
      geojson: { type: "FeatureCollection", features: [] },
      plotCount: 2,
      createdBy: user.id
    });
    return { user, polygon };
  };

  const createPolygonWithCriteria = async (status: PolygonStatus) => {
    const user = await UserFactory.create();
    const polygon = await SitePolygonFactory.create({
      status,
      validationStatus: "passed",
      practice: ["tree-planting"],
      targetSys: "agroforest",
      distr: ["full"],
      numTrees: 100,
      plantStart: new Date("2024-01-15T00:00:00.000Z"),
      createdBy: user.id
    });
    await CriteriaSite.create({ criteriaId: 3, polygonId: polygon.polygonUuid, valid: true } as CriteriaSite);
    return { user, polygon };
  };

  const createVersion = (
    polygon: SitePolygon,
    userId: number,
    payload: AttributeChangesDto,
    canReview: boolean,
    newGeometry?: CreateSitePolygonRequestDto[]
  ) =>
    SitePolygon.sql.transaction(transaction =>
      service.createSitePolygonVersion(
        polygon.uuid,
        newGeometry,
        payload,
        "Updated polygon attributes from edit drawer",
        userId,
        "Test User",
        "terramatch",
        transaction,
        canReview,
        true,
        canReview
      )
    );

  it("keeps status, validation and ANR plots when a reviewer only changes the submission cycle", async () => {
    const { user, polygon } = await createApprovedPolygonWithPlotsAndCriteria();

    const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { submissionCycle: "2" }), true);

    await newVersion.reload();
    expect(newVersion.uuid).not.toBe(polygon.uuid);
    expect(newVersion.status).toBe("approved");
    expect(newVersion.validationStatus).toBe("passed");
    expect(newVersion.submissionCycle).toBe("2");
    expect(await CriteriaSite.count({ where: { polygonId: polygon.polygonUuid } })).toBe(1);
    const plot = await AnrPlotGeometry.findOne({ where: { sitePolygonId: newVersion.id } });
    expect(plot?.plotCount).toBe(2);
  });

  it("resets to draft when a non-reviewer changes the submission cycle", async () => {
    const { user, polygon } = await createApprovedPolygonWithPlotsAndCriteria();

    const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { submissionCycle: "2" }), false);

    await newVersion.reload();
    expect(newVersion.status).toBe("draft");
    expect(newVersion.validationStatus).toBeNull();
    expect(await CriteriaSite.count({ where: { polygonId: polygon.polygonUuid } })).toBe(0);
  });

  it("returns an approved polygon to pending-approval when a reviewer changes a validated attribute", async () => {
    const { user, polygon } = await createApprovedPolygonWithPlotsAndCriteria();

    const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { numTrees: 500 }), true);

    await newVersion.reload();
    expect(newVersion.status).toBe("pending-approval");
    expect(newVersion.validationStatus).toBeNull();
    expect(await CriteriaSite.count({ where: { polygonId: polygon.polygonUuid } })).toBe(0);
  });

  it.each<PolygonStatus>(["draft", "pending-approval", "information-required"])(
    "keeps %s status and resets validation when a reviewer changes a validated attribute",
    async status => {
      const { user, polygon } = await createPolygonWithCriteria(status);

      const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { numTrees: 500 }), true);

      await newVersion.reload();
      expect(newVersion.status).toBe(status);
      expect(newVersion.validationStatus).toBeNull();
      expect(newVersion.numTrees).toBe(500);
      expect(await CriteriaSite.count({ where: { polygonId: polygon.polygonUuid } })).toBe(0);
    }
  );

  it("keeps pending-approval status and validation when a reviewer only changes the submission cycle", async () => {
    const { user, polygon } = await createPolygonWithCriteria("pending-approval");

    const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { submissionCycle: "2" }), true);

    await newVersion.reload();
    expect(newVersion.status).toBe("pending-approval");
    expect(newVersion.validationStatus).toBe("passed");
    expect(await CriteriaSite.count({ where: { polygonId: polygon.polygonUuid } })).toBe(1);
  });

  it.each<PolygonStatus>(["pending-approval", "approved"])(
    "moves a %s polygon to pending-approval and resets validation when a reviewer changes the geometry",
    async status => {
      const { user, polygon } = await createPolygonWithCriteria(status);
      const newGeometry = await PolygonGeometryFactory.create({ createdBy: user.id });
      await CriteriaSite.create({ criteriaId: 3, polygonId: newGeometry.uuid, valid: true } as CriteriaSite);
      jest
        .spyOn(polygonGeometryService, "createGeometriesFromFeatures")
        .mockResolvedValue({ uuids: [newGeometry.uuid], areas: [12.5] });
      const geometryRequest: CreateSitePolygonRequestDto = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: newGeometry.polygon, properties: { siteId: polygon.siteUuid } }]
      };

      const newVersion = await createVersion(polygon, user.id, {}, true, [geometryRequest]);

      await newVersion.reload();
      expect(newVersion.polygonUuid).toBe(newGeometry.uuid);
      expect(newVersion.status).toBe("pending-approval");
      expect(newVersion.validationStatus).toBeNull();
      expect(await CriteriaSite.count({ where: { polygonId: newGeometry.uuid } })).toBe(0);
    }
  );

  it("returns a pending-approval polygon to draft when a non-reviewer changes a validated attribute", async () => {
    const { user, polygon } = await createPolygonWithCriteria("pending-approval");

    const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { numTrees: 500 }), false);

    await newVersion.reload();
    expect(newVersion.status).toBe("draft");
    expect(newVersion.validationStatus).toBeNull();
  });

  it("applies the same review state rules to bulk attribute updates", async () => {
    const { user, polygon: pending } = await createPolygonWithCriteria("pending-approval");
    const { polygon: approved } = await createPolygonWithCriteria("approved");

    const [pendingVersion, approvedVersion] = await SitePolygon.sql.transaction(transaction =>
      service.bulkUpdateSitePolygonAttributes(
        [pending.uuid, approved.uuid],
        { numTrees: 500 },
        user.id,
        "Test User",
        "terramatch",
        transaction,
        true,
        true
      )
    );

    await pendingVersion.reload();
    await approvedVersion.reload();
    expect(pendingVersion.status).toBe("pending-approval");
    expect(pendingVersion.validationStatus).toBeNull();
    expect(approvedVersion.status).toBe("pending-approval");
    expect(approvedVersion.validationStatus).toBeNull();
    expect(await CriteriaSite.count({ where: { polygonId: [pending.polygonUuid, approved.polygonUuid] } })).toBe(0);
  });
});
