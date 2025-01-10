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
      await service.updateAirtableJob("nursery", 10);
      expect(queue.add).toHaveBeenCalledWith("updateEntities", { entityType: "nursery", startPage: 10 });
    });
  });
});
