import { WebhookController } from "./webhook.controller";
import { Test } from "@nestjs/testing";
import { AirtableService } from "../airtable/airtable.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UnauthorizedException } from "@nestjs/common";
import { Permission } from "@terramatch-microservices/database/entities";

describe("WebhookController", () => {
  let controller: WebhookController;
  let service: DeepMocked<AirtableService>;
  let permissionSpy: jest.SpyInstance<Promise<string[]>, [userId: number]>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: AirtableService, useValue: (service = createMock<AirtableService>()) }]
    }).compile();

    controller = module.get(WebhookController);
    permissionSpy = jest.spyOn(Permission, "getUserPermissionNames");
    permissionSpy.mockResolvedValue(["reports-manage"]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("updateRecords", () => {
    it("should throw an error if the user doesn't have the correct permissions", async () => {
      permissionSpy.mockResolvedValue([]);
      await expect(controller.updateRecords({ entityType: "project" }, { authenticatedUserId: 1 })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should call into the service with query params", async () => {
      let result = await controller.updateRecords({ entityType: "project", startPage: 2 }, { authenticatedUserId: 1 });
      expect(result).toEqual({ status: "OK" });
      expect(service.updateAirtableJob).toHaveBeenCalledWith("project", 2);

      result = await controller.updateRecords({ entityType: "site-report" }, { authenticatedUserId: 1 });
      expect(result).toEqual({ status: "OK" });
      expect(service.updateAirtableJob).toHaveBeenCalledWith("site-report", undefined);
    });
  });

  describe("removeDeletedRecords", () => {
    it("should throw an error if the user doesn't have the correct permissions", async () => {
      permissionSpy.mockResolvedValue([]);
      await expect(
        controller.removeDeletedRecords({ entityType: "project", deletedSince: new Date() }, { authenticatedUserId: 1 })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should call into the service with query params", async () => {
      const deletedSince = new Date();
      const result = await controller.removeDeletedRecords(
        { entityType: "project", deletedSince },
        { authenticatedUserId: 1 }
      );
      expect(result).toEqual({ status: "OK" });
      expect(service.deleteAirtableJob).toHaveBeenCalledWith("project", deletedSince);
    });
  });
});
