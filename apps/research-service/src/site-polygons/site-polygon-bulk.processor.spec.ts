import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Job, Queue } from "bullmq";
import { DelayedJob, Site } from "@terramatch-microservices/database/entities";
import { SiteFactory, SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { buildDeletedResponse, buildJsonApi, getDtoType, Resource } from "@terramatch-microservices/common/util";
import {
  BULK_ATTRIBUTE_UPDATE,
  BULK_DELETE,
  BULK_STATUS_UPDATE,
  BulkAttributeUpdateJobData,
  BulkDeleteJobData,
  BulkStatusUpdateJobData,
  SitePolygonBulkProcessor
} from "./site-polygon-bulk.processor";
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonBulkUpdateService } from "./site-polygon-bulk-update.service";
import { SitePolygonFullDto, SitePolygonLightDto } from "./dto/site-polygon.dto";

describe("SitePolygonBulkProcessor", () => {
  let processor: SitePolygonBulkProcessor;
  let sitePolygonsService: DeepMocked<SitePolygonsService>;
  let sitePolygonBulkUpdateService: DeepMocked<SitePolygonBulkUpdateService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SitePolygonBulkProcessor,
        { provide: SitePolygonsService, useValue: (sitePolygonsService = createMock<SitePolygonsService>()) },
        {
          provide: SitePolygonBulkUpdateService,
          useValue: (sitePolygonBulkUpdateService = createMock<SitePolygonBulkUpdateService>())
        }
      ]
    }).compile();

    processor = module.get(SitePolygonBulkProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const findDelayedJob = async (response: Awaited<ReturnType<typeof SitePolygonBulkProcessor.queueBulkDelete>>) =>
    await DelayedJob.findOne({ where: { uuid: (serialize(response).data as Resource).id } });

  describe("queueBulkDelete", () => {
    it("queues one entry per polygon and names the job after a single site", async () => {
      const site = await SiteFactory.create({ name: "Bulk Delete Site" });
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const oldVersion = await SitePolygonFactory.build({
        siteUuid: site.uuid,
        primaryUuid: sitePolygon.primaryUuid
      });
      const otherSitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const queue = createMock<Queue>();

      const response = await SitePolygonBulkProcessor.queueBulkDelete(queue, [
        sitePolygon,
        oldVersion,
        otherSitePolygon
      ]);

      const delayedJob = await findDelayedJob(response);
      expect(delayedJob).toMatchObject({
        name: "Polygon Bulk Delete",
        totalContent: 2,
        processedContent: 0,
        isAcknowledged: false,
        metadata: { entity_type: Site.LARAVEL_TYPE, entity_name: "Bulk Delete Site" }
      });
      expect(queue.add).toHaveBeenCalledWith(BULK_DELETE, {
        delayedJobId: delayedJob?.id,
        primaryUuids: [sitePolygon.primaryUuid, otherSitePolygon.primaryUuid]
      });
    });

    it("names the job by its polygon count when the polygons span several sites", async () => {
      const sitePolygons = await Promise.all([SitePolygonFactory.create(), SitePolygonFactory.create()]);

      const delayedJob = await findDelayedJob(
        await SitePolygonBulkProcessor.queueBulkDelete(createMock<Queue>(), sitePolygons)
      );

      expect(delayedJob?.metadata).toEqual({ entity_name: "2 polygons" });
    });

    it("queues a status update with one entry per requested polygon", async () => {
      const sitePolygons = await Promise.all([SitePolygonFactory.create(), SitePolygonFactory.create()]);
      const data = sitePolygons.map(({ uuid }) => ({ type: "sitePolygons", id: uuid }));
      const queue = createMock<Queue>();

      const delayedJob = await findDelayedJob(
        await SitePolygonBulkProcessor.queueBulkStatusUpdate(queue, sitePolygons, {
          userId: 3,
          status: "approved",
          data,
          comment: "Looks good"
        })
      );

      expect(delayedJob).toMatchObject({ name: "Polygon Bulk Status Update", totalContent: 2, processedContent: 0 });
      expect(queue.add).toHaveBeenCalledWith(BULK_STATUS_UPDATE, {
        delayedJobId: delayedJob?.id,
        userId: 3,
        status: "approved",
        data,
        comment: "Looks good"
      });
    });

    it("queues an attribute update with one entry per requested polygon", async () => {
      const sitePolygons = await Promise.all([SitePolygonFactory.create(), SitePolygonFactory.create()]);
      const sitePolygonUuids = sitePolygons.map(({ uuid }) => uuid);
      const queue = createMock<Queue>();

      const delayedJob = await findDelayedJob(
        await SitePolygonBulkProcessor.queueBulkAttributeUpdate(queue, sitePolygons, {
          userId: 3,
          sitePolygonUuids,
          attributeChanges: { numTrees: 10 }
        })
      );

      expect(delayedJob).toMatchObject({ name: "Polygon Bulk Attribute Update", totalContent: 2 });
      expect(queue.add).toHaveBeenCalledWith(BULK_ATTRIBUTE_UPDATE, {
        delayedJobId: delayedJob?.id,
        userId: 3,
        sitePolygonUuids,
        attributeChanges: { numTrees: 10 }
      });
    });
  });

  describe("processDelayedJob", () => {
    const buildJob = (name = BULK_DELETE) =>
      ({ name, data: { delayedJobId: 1, primaryUuids: ["primary-1", "primary-2"] } }) as Job<BulkDeleteJobData>;

    it("deletes in batches, records progress and returns the endpoint's deleted response", async () => {
      const update = jest.spyOn(DelayedJob, "update").mockResolvedValue([1] as never);
      const deletedUuids = ["version-1", "version-2", "version-3"];
      sitePolygonsService.bulkDeleteSitePolygonsInBatches.mockImplementation(async (_primaryUuids, onProgress) => {
        await onProgress(2);
        return deletedUuids;
      });

      const { processedContent, payload } = await processor.processDelayedJob(buildJob());

      expect(sitePolygonsService.bulkDeleteSitePolygonsInBatches).toHaveBeenCalledWith(
        ["primary-1", "primary-2"],
        expect.any(Function)
      );
      expect(update).toHaveBeenCalledWith({ processedContent: 2 }, { where: { id: 1 } });
      expect(processedContent).toBe(2);
      expect(payload).toEqual(buildDeletedResponse(getDtoType(SitePolygonFullDto), deletedUuids));
    });

    it("updates the status and returns the endpoint's light DTO document", async () => {
      const sitePolygons = await Promise.all([SitePolygonFactory.build(), SitePolygonFactory.build()]);
      sitePolygonBulkUpdateService.updateStatus.mockResolvedValue(sitePolygons);
      const document = buildJsonApi(SitePolygonLightDto);
      sitePolygonsService.buildLightDocument.mockResolvedValue(document);
      const data = sitePolygons.map(({ uuid }) => ({ type: "sitePolygons", id: uuid }));
      const job = {
        name: BULK_STATUS_UPDATE,
        data: { delayedJobId: 4, userId: 3, status: "approved", data }
      } as Job<BulkStatusUpdateJobData>;

      const { processedContent, payload } = await processor.processDelayedJob(job);

      expect(sitePolygonBulkUpdateService.updateStatus).toHaveBeenCalledWith("approved", data, undefined, 3);
      expect(sitePolygonsService.buildLightDocument).toHaveBeenCalledWith(sitePolygons);
      expect(processedContent).toBe(2);
      expect(payload).toBe(document);
    });

    it("updates the attributes and returns the endpoint's light DTO document", async () => {
      const newVersions = await Promise.all([SitePolygonFactory.build(), SitePolygonFactory.build()]);
      sitePolygonBulkUpdateService.updateAttributes.mockResolvedValue(newVersions);
      const document = buildJsonApi(SitePolygonLightDto);
      sitePolygonsService.buildLightDocument.mockResolvedValue(document);
      const job = {
        name: BULK_ATTRIBUTE_UPDATE,
        data: { delayedJobId: 5, userId: 3, sitePolygonUuids: ["a", "b"], attributeChanges: { numTrees: 10 } }
      } as Job<BulkAttributeUpdateJobData>;

      const { processedContent, payload } = await processor.processDelayedJob(job);

      expect(sitePolygonBulkUpdateService.updateAttributes).toHaveBeenCalledWith(["a", "b"], { numTrees: 10 }, 3);
      expect(sitePolygonsService.buildLightDocument).toHaveBeenCalledWith(newVersions);
      expect(processedContent).toBe(2);
      expect(payload).toBe(document);
    });

    it("rejects an unknown job name", async () => {
      await expect(processor.processDelayedJob(buildJob("unknown"))).rejects.toThrow("Unsupported job name: unknown");
      expect(sitePolygonsService.bulkDeleteSitePolygonsInBatches).not.toHaveBeenCalled();
    });
  });
});
