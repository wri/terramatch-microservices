import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { Relationship, Resource } from "@terramatch-microservices/common/util";

describe("UsersController", () => {
  let controller: UsersController;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }]
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw not found if the user is not found", async () => {
    await expect(controller.findOne("0", { authenticatedUserId: 1 })).rejects.toThrow(NotFoundException);
  });

  it("should throw an error if the policy does not authorize", async () => {
    policyService.authorize.mockRejectedValue(new UnauthorizedException());
    const { id } = await UserFactory.create();
    await expect(controller.findOne(`${id}`, { authenticatedUserId: 1 })).rejects.toThrow(UnauthorizedException);
  });

  it('should return the currently logged in user if the id is "me"', async () => {
    const { id, uuid } = await UserFactory.create();
    const result = await controller.findOne("me", { authenticatedUserId: id });
    expect((result.data as Resource).id).toBe(uuid);
  });

  it("should return the indicated user if the logged in user is allowed to access", async () => {
    policyService.authorize.mockResolvedValue(undefined);
    const { id, uuid } = await UserFactory.create();
    const result = await controller.findOne(`${id}`, { authenticatedUserId: id + 1 });
    expect((result.data as Resource).id).toBe(uuid);
  });

  it("should return a document without includes if there is no org", async () => {
    const { id } = await UserFactory.create();
    const result = await controller.findOne("me", { authenticatedUserId: id });
    expect(result.included).not.toBeDefined();
  });

  it("should include the primary org for the user", async () => {
    const user = await UserFactory.create();
    const org = await OrganisationFactory.create();
    await user.$add("organisationsConfirmed", org);
    const result = await controller.findOne("me", { authenticatedUserId: user.id });
    expect(result.included).toHaveLength(1);
    expect(result.included[0]).toMatchObject({ type: "organisations", id: org.uuid });
    const data = result.data as Resource;
    expect(data.relationships.org).toBeDefined();
    const relationship = data.relationships.org.data as Relationship;
    expect(relationship).toMatchObject({ type: "organisations", id: org.uuid, meta: { userStatus: "approved" } });
  });

  it('should return "na" for userStatus if there is no many to many relationship', async () => {
    const user = await UserFactory.create();
    const org = await OrganisationFactory.create();
    await user.$set("organisation", org);
    const result = await controller.findOne("me", { authenticatedUserId: user.id });
    expect(result.included).toHaveLength(1);
    expect(result.included[0]).toMatchObject({ type: "organisations", id: org.uuid });
    const data = result.data as Resource;
    expect(data.relationships.org).toBeDefined();
    const relationship = data.relationships.org.data as Relationship;
    expect(relationship).toMatchObject({ type: "organisations", id: org.uuid, meta: { userStatus: "na" } });
  });
});
