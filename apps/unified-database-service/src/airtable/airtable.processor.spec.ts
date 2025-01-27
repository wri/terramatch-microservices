import { AIRTABLE_ENTITIES, AirtableProcessor, ENTITY_TYPES } from "./airtable.processor";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { createMock } from "@golevelup/ts-jest";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import { Job } from "bullmq";
import { SlackService } from "nestjs-slack";

jest.mock("airtable", () =>
  jest.fn(() => ({
    base: () => jest.fn()
  }))
);

describe("AirtableProcessor", () => {
  let processor: AirtableProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AirtableProcessor,
        { provide: ConfigService, useValue: createMock<ConfigService>() },
        { provide: SlackService, useValue: createMock<SlackService>() }
      ]
    }).compile();

    processor = await module.resolve(AirtableProcessor);
  });

  it("throws an error with an unknown job name", async () => {
    await expect(processor.process({ name: "unknown" } as Job)).rejects.toThrow(NotImplementedException);
  });

  describe("updateEntities", () => {
    it("throws an error with an unknown entity type", async () => {
      await expect(processor.process({ name: "updateEntities", data: { entityType: "foo" } } as Job)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("calls updateBase on the entity", async () => {
      const updateBase = jest.fn(() => Promise.resolve());
      // @ts-expect-error faking the SiteEntity
      AIRTABLE_ENTITIES.site = class {
        updateBase = updateBase;
      };
      const updatedSince = new Date();
      await processor.process({
        name: "updateEntities",
        data: { entityType: "site", startPage: 2, updatedSince }
      } as Job);
      expect(updateBase).toHaveBeenCalledWith(expect.anything(), { startPage: 2, updatedSince });
    });
  });

  describe("deleteEntities", () => {
    it("throws an error with an unknown entity type", async () => {
      await expect(processor.process({ name: "deleteEntities", data: { entityType: "foo" } } as Job)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("calls deleteStaleRecords on the entity", async () => {
      const deleteStaleRecords = jest.fn(() => Promise.resolve());
      // @ts-expect-error faking the SiteEntity
      AIRTABLE_ENTITIES.site = class {
        deleteStaleRecords = deleteStaleRecords;
      };
      const deletedSince = new Date();
      await processor.process({ name: "deleteEntities", data: { entityType: "site", deletedSince } } as Job);
      expect(deleteStaleRecords).toHaveBeenCalledWith(expect.anything(), deletedSince);
    });
  });

  describe("updateAll", () => {
    it("calls updateEntities and deleteEntities with all types", async () => {
      const updateSpy = (
        jest.spyOn(processor as never, "updateEntities") as jest.SpyInstance<Promise<void>>
      ).mockImplementation(() => Promise.resolve());
      const deleteSpy = (
        jest.spyOn(processor as never, "deleteEntities") as jest.SpyInstance<Promise<void>>
      ).mockImplementation(() => Promise.resolve());

      const updatedSince = new Date();
      await processor.process({ name: "updateAll", data: { updatedSince } } as Job);

      for (let ii = 0; ii < ENTITY_TYPES.length; ii++) {
        const entityType = ENTITY_TYPES[ii];
        expect(updateSpy).toHaveBeenNthCalledWith(ii + 1, { entityType, updatedSince });
        expect(deleteSpy).toHaveBeenNthCalledWith(ii + 1, { entityType, deletedSince: updatedSince });
      }

      updateSpy.mockRestore();
      deleteSpy.mockRestore();
    });
  });
});
