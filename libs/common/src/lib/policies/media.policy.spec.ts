import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, mockPermissions, mockUserId } from "./policy.service.spec";
import { MediaFactory } from "@terramatch-microservices/database/factories";
import { UnauthorizedException } from "@nestjs/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";

describe("MediaPolicy", () => {
  let service: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [{ provide: PolicyService, useValue: (service = createMock<PolicyService>()) }]
    }).compile();

    service = await module.resolve(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("bulkDelete", () => {
    it("should allow bulk delete if the user has the media-manage permission and the media is created by the user", async () => {
      mockUserId(123);
      mockPermissions("media-manage");
      service.authorize.mockResolvedValue();
      await expectCan(service, "bulkDelete", await MediaFactory.forProject.create({ createdBy: 123 }));
    });

    it("should not allow bulk delete if the user does not have the media-manage permission even if the media is created by the user", async () => {
      mockUserId(123);
      mockPermissions();
      service.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(
        service.authorize("bulkDelete", await MediaFactory.forProject.create({ createdBy: 123 }))
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should not allow bulk delete if the user have the media-manage permission but the media is not created by the user", async () => {
      mockUserId(123);
      mockPermissions("media-manage");
      service.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(
        service.authorize("bulkDelete", await MediaFactory.forProject.create({ createdBy: 124 }))
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
