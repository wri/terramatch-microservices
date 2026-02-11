import { OrganisationsController } from "./organisations.controller";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { OrganisationsService } from "./organisations.service";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import { OrganisationFactory } from "@terramatch-microservices/database/factories";
import { Organisation } from "@terramatch-microservices/database/entities";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";

const createRequest = (attributes: OrganisationCreateAttributes = new OrganisationCreateAttributes()) => ({
  data: { type: "organisations", attributes }
});

describe("OrganisationsController", () => {
  let controller: OrganisationsController;
  let policyService: DeepMocked<PolicyService>;
  let organisationsService: DeepMocked<OrganisationsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrganisationsController],
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: OrganisationsService,
          useValue: (organisationsService = createMock<OrganisationsService>())
        },
        { provide: getQueueToken("email"), useValue: createMock() },
        { provide: REQUEST, useValue: {} }
      ]
    }).compile();

    controller = module.get(OrganisationsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("returns orgs without funding programme filter", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.getPermissions.mockResolvedValue([]);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.index({}));

      expect(organisationsService.findMany).toHaveBeenCalledWith({}, false);
      expect(policyService.authorize).toHaveBeenCalledWith("read", orgs);
      expect(result.data).toHaveLength(2);
    });

    it("returns orgs associated with a funding programme", async () => {
      const programmeUuid = "test-programme-uuid";
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.getPermissions.mockResolvedValue([]);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.index({ fundingProgrammeUuid: programmeUuid }));

      expect(organisationsService.findMany).toHaveBeenCalledWith({ fundingProgrammeUuid: programmeUuid }, false);
      expect(policyService.authorize).toHaveBeenCalledWith("read", orgs);
      expect(result.data).toHaveLength(2);
      const uuids = (result.data as Resource[]).map(({ id }) => id);
      expect(uuids).toContain(orgs[0].uuid);
      expect(uuids).toContain(orgs[1].uuid);
    });

    it("uses admin permissions when user has framework permissions", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.getPermissions.mockResolvedValue(["framework-test"]);
      policyService.authorize.mockResolvedValue(undefined);

      await controller.index({});

      expect(organisationsService.findMany).toHaveBeenCalledWith({}, true);
    });
  });

  describe("create", () => {
    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.create(createRequest())).rejects.toThrow(UnauthorizedException);
    });

    it("should call the organisations service create method and return the organisation", async () => {
      const attrs = new OrganisationCreateAttributes();
      attrs.name = "Test Organisation";
      const org = await OrganisationFactory.create({ name: attrs.name });
      organisationsService.create.mockResolvedValue({ organisation: org });
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.create(createRequest(attrs)));

      expect(policyService.authorize).toHaveBeenCalledWith("create", Organisation);
      expect(organisationsService.create).toHaveBeenCalledWith(attrs);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
    });
  });

  describe("show", () => {
    it("should return a single organisation by UUID", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.show(org.uuid));

      expect(organisationsService.findOne).toHaveBeenCalledWith(org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", org);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = "non-existent-uuid";
      organisationsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.show(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if policy does not authorize", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.show(org.uuid)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("update", () => {
    it("should update organisation and return updated organisation", async () => {
      const org = await OrganisationFactory.create();
      const updateAttrs: OrganisationUpdateAttributes = {
        name: "Updated Name",
        status: "pending"
      };
      const updatedOrg = { ...org, name: "Updated Name", status: "pending" };

      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.update.mockResolvedValue(updatedOrg as Organisation);
      policyService.authorize.mockResolvedValue(undefined);

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: updateAttrs
        }
      };

      const result = serialize(await controller.update(org.uuid, updatePayload));

      expect(organisationsService.findOne).toHaveBeenCalledWith(org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("update", org);
      expect(organisationsService.update).toHaveBeenCalledWith(org, updateAttrs);
      expect(result.data).toBeDefined();
      expect((result.data as Resource).id).toBe(org.uuid);
    });

    it("should throw BadRequestException if UUID in path does not match payload", async () => {
      const org = await OrganisationFactory.create();
      const updateAttrs: OrganisationUpdateAttributes = { name: "Updated Name" };
      const updatePayload = {
        data: {
          type: "organisations",
          id: "different-uuid",
          attributes: updateAttrs
        }
      };

      await expect(controller.update(org.uuid, updatePayload)).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = "non-existent-uuid";
      organisationsService.findOne.mockRejectedValue(new NotFoundException());

      const updatePayload = {
        data: {
          type: "organisations",
          id: nonExistentUuid,
          attributes: { name: "Updated Name" }
        }
      };

      await expect(controller.update(nonExistentUuid, updatePayload)).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if policy does not authorize", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      const updatePayload = {
        data: {
          type: "organisations",
          id: org.uuid,
          attributes: { name: "Updated Name" }
        }
      };

      await expect(controller.update(org.uuid, updatePayload)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("delete", () => {
    it("should delete organisation and return deleted response", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      organisationsService.delete.mockResolvedValue(undefined);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.delete(org.uuid));

      expect(organisationsService.findOne).toHaveBeenCalledWith(org.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", org);
      expect(organisationsService.delete).toHaveBeenCalledWith(org);
      expect(result.meta).toBeDefined();
      expect((result.meta as { resourceIds?: string[] })?.resourceIds).toContain(org.uuid);
    });

    it("should throw NotFoundException if organisation does not exist", async () => {
      const nonExistentUuid = "non-existent-uuid";
      organisationsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.delete(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException if policy does not authorize", async () => {
      const org = await OrganisationFactory.create();
      organisationsService.findOne.mockResolvedValue(org);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.delete(org.uuid)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("index - additional cases", () => {
    it("should use lightResource when specified", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.getPermissions.mockResolvedValue([]);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.index({ lightResource: true }));

      expect(result.data).toHaveLength(2);
    });

    it("should use users-manage permission for admin check", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      organisationsService.findMany.mockResolvedValue({
        organisations: orgs,
        paginationTotal: 2
      });
      policyService.getPermissions.mockResolvedValue(["users-manage"]);
      policyService.authorize.mockResolvedValue(undefined);

      await controller.index({});

      expect(organisationsService.findMany).toHaveBeenCalledWith({}, true);
    });
  });
});
