import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { AirtableService } from "./airtable.service";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { DataApiService } from "@terramatch-microservices/data-api";

describe("AirtableService", () => {
  let service: AirtableService;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AirtableService,
        {
          provide: getQueueToken("airtable"),
          useValue: (queue = createMock<Queue>())
        },
        {
          provide: DataApiService,
          useValue: createMock<DataApiService>()
        }
      ]
    }).compile();

    service = module.get(AirtableService);
  });

  describe("updateAirtableJob", () => {
    it("adds the job to the queue", async () => {
      const updatedSince = new Date();
      await service.updateAirtable("nurseries", 10, updatedSince);
      expect(queue.add).toHaveBeenCalledWith("updateEntities", {
        entityType: "nurseries",
        startPage: 10,
        updatedSince
      });
    });
  });

  describe("deleteAirtableJob", () => {
    it("adds the job to the queue", async () => {
      const deletedSince = new Date();
      await service.deleteFromAirtable("projects", deletedSince);
      expect(queue.add).toHaveBeenCalledWith("deleteEntities", { entityType: "projects", deletedSince });
    });
  });

  describe("updateAll", () => {
    it("adds the job to the queue", async () => {
      const updatedSince = new Date();
      await service.updateAll(updatedSince);
      expect(queue.add).toHaveBeenCalledWith("updateAll", { updatedSince });
    });
  });

  describe("handleDailyUpdate", () => {
    it("adds the job to the queue", async () => {
      await service.handleDailyUpdate();
      expect(queue.add).toHaveBeenCalledWith("updateAll", { updatedSince: expect.any(Date) });
    });
  });
});
