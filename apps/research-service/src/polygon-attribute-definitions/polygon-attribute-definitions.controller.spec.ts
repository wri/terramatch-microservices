import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { PolygonAttributeDefinition } from "@terramatch-microservices/database/entities";
import { PolygonAttributeDefinitionFactory } from "@terramatch-microservices/database/factories";
import {
  CreatePolygonAttributeDefinitionAttributes,
  UpdatePolygonAttributeDefinitionAttributes
} from "./dto/polygon-attribute-definition.dto";
import { PolygonAttributeDefinitionsController } from "./polygon-attribute-definitions.controller";
import { PolygonAttributeDefinitionsService } from "./polygon-attribute-definitions.service";

describe("PolygonAttributeDefinitionsController", () => {
  let controller: PolygonAttributeDefinitionsController;
  let service: DeepMocked<PolygonAttributeDefinitionsService>;
  let policyService: DeepMocked<PolicyService>;
  const createdDefinitionIds: number[] = [];

  const attributes = (): CreatePolygonAttributeDefinitionAttributes => ({
    label: "ANR Subcategory",
    inputType: "single_select",
    frameworkKey: "terrafund",
    options: [{ label: "Farmer managed" }]
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolygonAttributeDefinitionsController],
      providers: [
        { provide: PolygonAttributeDefinitionsService, useValue: (service = createMock()) },
        { provide: PolicyService, useValue: (policyService = createMock()) }
      ]
    }).compile();

    controller = module.get(PolygonAttributeDefinitionsController);
    policyService.authorize.mockResolvedValue(undefined);
    Object.defineProperty(policyService, "permissions", { value: [], writable: true, configurable: true });
    const document = createMock<DocumentBuilder>();
    document.serialize.mockReturnValue({ data: [] } as never);
    service.addDto.mockResolvedValue(document);
    service.addDtos.mockResolvedValue(document);
    createdDefinitionIds.length = 0;
  });

  afterEach(async () => {
    if (createdDefinitionIds.length > 0) {
      await PolygonAttributeDefinition.destroy({ where: { id: createdDefinitionIds }, force: true });
    }
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("requests all definitions (including inactive) for framework admins", async () => {
      Object.defineProperty(policyService, "permissions", {
        value: ["framework-ppc"],
        writable: true,
        configurable: true
      });
      const definitions = await Promise.all([
        PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" }),
        PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc", isActive: false })
      ]);
      createdDefinitionIds.push(...definitions.map(d => d.id));
      service.findAll.mockResolvedValue(definitions as never);

      await controller.index({ frameworkKey: "ppc" });

      expect(service.findAll).toHaveBeenCalledWith("ppc", false);
      expect(policyService.authorize).toHaveBeenCalledWith("read", definitions);
      expect(service.addDtos).toHaveBeenCalled();
    });

    it("requests active-only definitions for non framework-admin callers", async () => {
      Object.defineProperty(policyService, "permissions", {
        value: ["manage-own"],
        writable: true,
        configurable: true
      });
      const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
      createdDefinitionIds.push(definition.id);
      service.findAll.mockResolvedValue([definition] as never);

      await controller.index({ frameworkKey: "ppc" });

      expect(service.findAll).toHaveBeenCalledWith("ppc", true);
    });

    it("treats admin permissions for a different framework as non-admin for this request", async () => {
      Object.defineProperty(policyService, "permissions", {
        value: ["framework-terrafund"],
        writable: true,
        configurable: true
      });
      service.findAll.mockResolvedValue([]);

      await controller.index({ frameworkKey: "ppc" });

      expect(service.findAll).toHaveBeenCalledWith("ppc", true);
    });

    it("authorizes a built instance when the list is empty so empty results are not a policy bypass", async () => {
      service.findAll.mockResolvedValue([]);

      await controller.index({ frameworkKey: "ppc" });

      expect(policyService.authorize).toHaveBeenCalledWith("read", expect.objectContaining({ frameworkKey: "ppc" }));
    });

    it("throws when the user is not allowed to read the framework", async () => {
      service.findAll.mockResolvedValue([]);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.index({ frameworkKey: "ppc" })).rejects.toThrow(UnauthorizedException);
      expect(service.addDtos).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("returns a definition after authorizing read", async () => {
      const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
      createdDefinitionIds.push(definition.id);
      service.findOne.mockResolvedValue(definition as never);

      serialize(await controller.get(definition.uuid));

      expect(service.findOne).toHaveBeenCalledWith(definition.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", definition);
      expect(service.addDto).toHaveBeenCalled();
    });

    it("propagates NotFoundException", async () => {
      service.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.get("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("authorizes create on a built instance for the payload framework", async () => {
      const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "terrafund" });
      createdDefinitionIds.push(definition.id);
      service.create.mockResolvedValue(definition as never);

      await controller.create({
        data: { type: "polygonAttributeDefinitions", attributes: attributes() }
      });

      expect(policyService.authorize).toHaveBeenCalledWith(
        "create",
        expect.objectContaining({ frameworkKey: "terrafund" })
      );
      expect(service.create).toHaveBeenCalledWith(attributes());
    });
  });

  describe("update", () => {
    it("rejects mismatched path and payload ids", async () => {
      await expect(
        controller.update("uuid-1", {
          data: {
            id: "uuid-2",
            type: "polygonAttributeDefinitions",
            attributes: {} as UpdatePolygonAttributeDefinitionAttributes
          }
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("authorizes and updates", async () => {
      const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
      createdDefinitionIds.push(definition.id);
      service.findOne.mockResolvedValue(definition as never);
      service.update.mockResolvedValue(definition as never);
      const updateAttributes = { isActive: false };

      await controller.update(definition.uuid, {
        data: { id: definition.uuid, type: "polygonAttributeDefinitions", attributes: updateAttributes }
      });

      expect(policyService.authorize).toHaveBeenCalledWith("update", definition);
      expect(service.update).toHaveBeenCalledWith(definition, updateAttributes);
    });
  });

  describe("delete", () => {
    it("authorizes and deletes", async () => {
      const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
      createdDefinitionIds.push(definition.id);
      service.findOne.mockResolvedValue(definition as never);
      service.delete.mockResolvedValue(undefined);

      const result = await controller.delete(definition.uuid);

      expect(policyService.authorize).toHaveBeenCalledWith("delete", definition);
      expect(service.delete).toHaveBeenCalledWith(definition);
      expect(result.meta).toEqual(
        expect.objectContaining({
          resourceType: "polygonAttributeDefinitions",
          resourceIds: [definition.uuid]
        })
      );
    });
  });
});
