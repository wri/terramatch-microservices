import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { AirtableService } from "./airtable.service";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";

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
        }
      ]
    }).compile();

    service = module.get(AirtableService);
  });

  describe("updateAirtableJob", () => {
    it("adds the job to the queue", async () => {
      const updatedSince = new Date();
      await service.updateAirtableJob("nursery", 10, updatedSince);
      expect(queue.add).toHaveBeenCalledWith("updateEntities", { entityType: "nursery", startPage: 10, updatedSince });
    });
  });

  describe("deleteAirtableJob", () => {
    it("adds the job to the queue", async () => {
      const deletedSince = new Date();
      await service.deleteAirtableJob("project", deletedSince);
      expect(queue.add).toHaveBeenCalledWith("deleteEntities", { entityType: "project", deletedSince });
    });
  });
});
