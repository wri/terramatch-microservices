import { Test } from "@nestjs/testing";
import { createMock } from "@golevelup/ts-jest";
import { AnrPlotGeometry, CriteriaSite, SitePolygon } from "@terramatch-microservices/database/entities";
import { SitePolygonFactory, UserFactory } from "@terramatch-microservices/database/factories";
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
import { AttributeChangesDto } from "./dto/create-site-polygon-request.dto";

describe("SitePolygonCreationService review state (DB)", () => {
  let service: SitePolygonCreationService;

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

  const createVersion = (polygon: SitePolygon, userId: number, payload: AttributeChangesDto, canReview: boolean) =>
    SitePolygon.sql.transaction(transaction =>
      service.createSitePolygonVersion(
        polygon.uuid,
        undefined,
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

  it("resets to draft when a reviewer changes a validated attribute", async () => {
    const { user, polygon } = await createApprovedPolygonWithPlotsAndCriteria();

    const newVersion = await createVersion(polygon, user.id, drawerPayload(polygon, { numTrees: 500 }), true);

    await newVersion.reload();
    expect(newVersion.status).toBe("draft");
  });
});
