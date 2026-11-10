import { Test } from "@nestjs/testing";
import { createMock } from "@golevelup/ts-jest";
import { Polygon } from "geojson";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  PolygonGeometryFactory,
  ProjectFactory,
  SiteFactory,
  SitePolygonFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
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

const squareAround = (lng: number, lat: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [lng - 0.01, lat - 0.01],
      [lng + 0.01, lat - 0.01],
      [lng + 0.01, lat + 0.01],
      [lng - 0.01, lat + 0.01],
      [lng - 0.01, lat - 0.01]
    ]
  ]
});

describe("SitePolygonCreationService version centroids (DB)", () => {
  let service: SitePolygonCreationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SitePolygonCreationService,
        SitePolygonVersioningService,
        PolygonGeometryCreationService,
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

  it("moves the version and project centroids to the new geometry", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    const geometry = await PolygonGeometryFactory.create({ polygon: squareAround(10, 20) });
    const polygon = await SitePolygonFactory.create({
      siteUuid: site.uuid,
      polygonUuid: geometry.uuid,
      lat: 20,
      long: 10,
      createdBy: user.id
    });

    const newVersion = await SitePolygon.sql.transaction(transaction =>
      service.createSitePolygonVersion(
        polygon.uuid,
        [
          { type: "FeatureCollection", features: [{ type: "Feature", geometry: squareAround(30, 40), properties: {} }] }
        ],
        undefined,
        "Updated geometry from map edit",
        user.id,
        "Test User",
        "terramatch",
        transaction
      )
    );

    await newVersion.reload();
    await project.reload();
    expect(newVersion.polygonUuid).not.toBe(geometry.uuid);
    expect(newVersion.long).toBeCloseTo(30);
    expect(newVersion.lat).toBeCloseTo(40);
    expect(project.long).toBeCloseTo(30);
    expect(project.lat).toBeCloseTo(40);
  });
});
