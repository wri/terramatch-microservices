import { NotFoundException } from "@nestjs/common";
import {
  MediaOwnerType,
  MEDIA_OWNER_MODELS,
  MEDIA_OWNER_MODEL_LARAVEL_TYPES,
  EntityMediaOwnerClass,
  MediaOwnerModel
} from "@terramatch-microservices/database/constants/media-owners";
import { getBaseEntityByLaravelTypeAndId, MediaOwnerProcessor } from "./media-owner-processor";
import { DataTypes } from "sequelize";
import { Project } from "@terramatch-microservices/database/entities";

describe("MediaOwnerProcessor", () => {
  const FAKE_UUID = "fake-uuid";
  const MODEL_KEY: MediaOwnerType = "projects";
  let FakeModel: jest.Mocked<EntityMediaOwnerClass<MediaOwnerModel>>;
  let originalModel: EntityMediaOwnerClass<MediaOwnerModel>;

  beforeEach(() => {
    FakeModel = class FakeModel {} as jest.Mocked<EntityMediaOwnerClass<MediaOwnerModel>>;
    FakeModel.getAttributes = jest.fn();
    FakeModel.findOne = jest.fn();
    originalModel = MEDIA_OWNER_MODELS[MODEL_KEY];
    MEDIA_OWNER_MODELS[MODEL_KEY] = FakeModel;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    MEDIA_OWNER_MODELS[MODEL_KEY] = originalModel;
  });

  describe("baseModelAttributes", () => {
    it("should return the expected attribute keys", () => {
      const processor = new MediaOwnerProcessor(MODEL_KEY as MediaOwnerType, FAKE_UUID, FakeModel);
      expect(processor.baseModelAttributes).toEqual([
        "id",
        "frameworkKey",
        "projectId",
        "siteId",
        "nurseryId",
        "organisationId",
        "createdBy"
      ]);
    });
  });

  describe("getBaseEntity", () => {
    it("should find and return the base entity with intersected attributes", async () => {
      FakeModel.getAttributes.mockReturnValue({
        id: { type: DataTypes.INTEGER },
        frameworkKey: { type: DataTypes.STRING },
        projectId: { type: DataTypes.INTEGER },
        extra: { type: DataTypes.STRING }
      });
      const baseEntity = { id: 1, frameworkKey: "fk", projectId: 2 } as unknown as MediaOwnerModel;
      FakeModel.findOne.mockResolvedValue(baseEntity);

      const processor = new MediaOwnerProcessor(MODEL_KEY as MediaOwnerType, FAKE_UUID, FakeModel);
      const result = await processor.getBaseEntity();

      expect(FakeModel.findOne).toHaveBeenCalledWith({
        where: { uuid: FAKE_UUID },
        attributes: ["id", "frameworkKey", "projectId"]
      });
      expect(result).toBe(baseEntity);
    });

    it("should throw NotFoundException when no entity is found", async () => {
      FakeModel.getAttributes.mockReturnValue({
        id: { type: DataTypes.INTEGER },
        frameworkKey: { type: DataTypes.STRING },
        projectId: { type: DataTypes.INTEGER }
      });
      FakeModel.findOne.mockResolvedValue(null);

      const processor = new MediaOwnerProcessor(MODEL_KEY as MediaOwnerType, FAKE_UUID, FakeModel);
      await expect(processor.getBaseEntity()).rejects.toThrow(NotFoundException);
      await expect(processor.getBaseEntity()).rejects.toThrow(
        `Base entity not found: [${FakeModel.name}, ${FAKE_UUID}]`
      );
    });

    it("should memoize the base entity after the first call", async () => {
      FakeModel.getAttributes.mockReturnValue({
        id: { type: DataTypes.INTEGER },
        frameworkKey: { type: DataTypes.STRING },
        projectId: { type: DataTypes.INTEGER }
      });
      const baseEntity = { id: 1 } as unknown as MediaOwnerModel;
      FakeModel.findOne.mockResolvedValue(baseEntity);

      const processor = new MediaOwnerProcessor(MODEL_KEY as MediaOwnerType, FAKE_UUID, FakeModel);
      const first = await processor.getBaseEntity();
      const second = await processor.getBaseEntity();

      expect(first).toBe(second);
      expect(FakeModel.findOne).toHaveBeenCalledTimes(1);
    });
  });
});

describe("getBaseEntityByLaravelTypeAndId", () => {
  const LARAVEL_TYPE = Project.LARAVEL_TYPE;
  let FakeModel: jest.Mocked<EntityMediaOwnerClass<MediaOwnerModel>>;
  let originalModel: EntityMediaOwnerClass<MediaOwnerModel>;

  beforeEach(() => {
    FakeModel = class FakeModel {} as jest.Mocked<EntityMediaOwnerClass<MediaOwnerModel>>;
    FakeModel.getAttributes = jest.fn();
    FakeModel.findOne = jest.fn();
    originalModel = MEDIA_OWNER_MODEL_LARAVEL_TYPES[LARAVEL_TYPE];
    MEDIA_OWNER_MODEL_LARAVEL_TYPES[LARAVEL_TYPE] = FakeModel;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    MEDIA_OWNER_MODEL_LARAVEL_TYPES[LARAVEL_TYPE] = originalModel;
  });

  it("should find and return the base entity with intersected attributes", async () => {
    FakeModel.getAttributes.mockReturnValue({
      id: { type: DataTypes.INTEGER },
      frameworkKey: { type: DataTypes.STRING },
      projectId: { type: DataTypes.INTEGER }
    });
    FakeModel.findOne.mockResolvedValue({ id: 1, frameworkKey: "fk" } as unknown as Project);
    const model = await getBaseEntityByLaravelTypeAndId(LARAVEL_TYPE, 1);
    expect(FakeModel.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      attributes: ["id", "frameworkKey", "projectId"]
    });
    expect(model).toEqual({ id: 1, frameworkKey: "fk" });
  });
});
