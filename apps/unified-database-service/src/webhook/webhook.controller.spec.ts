import { WebhookController } from "./webhook.controller";
import { Test } from "@nestjs/testing";
import { AirtableService } from "../airtable/airtable.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UnauthorizedException } from "@nestjs/common";
import { Permission } from "@terramatch-microservices/database/entities";
import { mockUserId } from "@terramatch-microservices/common/policies/policy.service.spec";

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
      mockUserId(1);
      await expect(controller.updateRecords({ entityType: "projects" })).rejects.toThrow(UnauthorizedException);
    });

    it("should call into the service with query params", async () => {
      const updatedSince = new Date();
      mockUserId(1);
      let result = await controller.updateRecords({ entityType: "projects", startPage: 2, updatedSince });
      expect(result).toEqual({ status: "OK" });
      expect(service.updateAirtable).toHaveBeenCalledWith("projects", 2, updatedSince);

      result = await controller.updateRecords({ entityType: "siteReports" });
      expect(result).toEqual({ status: "OK" });
      expect(service.updateAirtable).toHaveBeenCalledWith("siteReports", undefined, undefined);
    });
  });

  describe("removeDeletedRecords", () => {
    it("should throw an error if the user doesn't have the correct permissions", async () => {
      permissionSpy.mockResolvedValue([]);
      mockUserId(1);
      await expect(
        controller.removeDeletedRecords({ entityType: "projects", deletedSince: new Date() })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should call into the service with query params", async () => {
      const deletedSince = new Date();
      mockUserId(1);
      const result = await controller.removeDeletedRecords({ entityType: "projects", deletedSince });
      expect(result).toEqual({ status: "OK" });
      expect(service.deleteFromAirtable).toHaveBeenCalledWith("projects", deletedSince);
    });
  });

  describe("updateAll", () => {
    it("should throw an error if the user doesn't have the correct permissions", async () => {
      permissionSpy.mockResolvedValue([]);
      mockUserId(1);
      await expect(controller.updateAll({ updatedSince: new Date() })).rejects.toThrow(UnauthorizedException);
    });

    it("should call into the service with query params", async () => {
      const updatedSince = new Date();
      mockUserId(1);
      const result = await controller.updateAll({ updatedSince: updatedSince });
      expect(result).toEqual({ status: "OK" });
      expect(service.updateAll).toHaveBeenCalledWith(updatedSince);
    });
  });
});
