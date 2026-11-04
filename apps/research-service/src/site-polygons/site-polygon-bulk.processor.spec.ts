import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Job, Queue } from "bullmq";
import { DelayedJob, Site } from "@terramatch-microservices/database/entities";
import { SiteFactory, SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { BULK_DELETE, BulkDeleteJobData, SitePolygonBulkProcessor } from "./site-polygon-bulk.processor";
import { SitePolygonsService } from "./site-polygons.service";

describe("SitePolygonBulkProcessor", () => {
  let processor: SitePolygonBulkProcessor;
  let sitePolygonsService: DeepMocked<SitePolygonsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SitePolygonBulkProcessor,
        { provide: SitePolygonsService, useValue: (sitePolygonsService = createMock<SitePolygonsService>()) }
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
  });

  describe("processDelayedJob", () => {
    const buildJob = (name = BULK_DELETE) =>
      ({ name, data: { delayedJobId: 1, primaryUuids: ["primary-1", "primary-2"] } }) as Job<BulkDeleteJobData>;

    it("deletes in batches, records progress and returns the deleted response", async () => {
      const update = jest.spyOn(DelayedJob, "update").mockResolvedValue([1] as never);
      sitePolygonsService.bulkDeleteSitePolygonsInBatches.mockImplementation(async (_primaryUuids, onProgress) => {
        await onProgress(2);
        return ["deleted-1", "deleted-2", "deleted-3"];
      });

      const { payload } = await processor.processDelayedJob(buildJob());

      expect(sitePolygonsService.bulkDeleteSitePolygonsInBatches).toHaveBeenCalledWith(
        ["primary-1", "primary-2"],
        expect.any(Function)
      );
      expect(update).toHaveBeenCalledWith({ processedContent: 2 }, { where: { id: 1 } });
      expect(payload).toMatchObject({
        meta: { resourceType: "sitePolygons", resourceIds: ["deleted-1", "deleted-2", "deleted-3"] }
      });
    });

    it("rejects an unknown job name", async () => {
      await expect(processor.processDelayedJob(buildJob("unknown"))).rejects.toThrow("Unsupported job name: unknown");
      expect(sitePolygonsService.bulkDeleteSitePolygonsInBatches).not.toHaveBeenCalled();
    });
  });
});
