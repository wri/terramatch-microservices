import { ProjectProcessor } from "./project.processor";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { ProjectFactory } from "@terramatch-microservices/database/factories";
import { ActionFactory } from "@terramatch-microservices/database/factories/action.factory";
import { PolicyService } from "@terramatch-microservices/common";

describe("EntityProcessor", () => {
  let processor: ProjectProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: createMock<PolicyService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("projects") as ProjectProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("delete", () => {
    it("deletes the requested model", async () => {
      const project = await ProjectFactory.create();
      await processor.delete(project);
      await project.reload({ paranoid: false });
      expect(project.deletedAt).not.toBeNull();
    });

    it("deletes associated actions", async () => {
      const project = await ProjectFactory.create();
      const actions = await ActionFactory.forProject.createMany(2, { targetableId: project.id });
      await processor.delete(project);
      for (const action of actions) {
        await action.reload({ paranoid: false });
        expect(action.deletedAt).not.toBeNull();
      }
    });
  });
});
