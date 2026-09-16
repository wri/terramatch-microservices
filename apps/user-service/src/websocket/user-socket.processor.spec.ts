import { Test, TestingModule } from "@nestjs/testing";
import { UserSocketProcessor } from "./user-socket.processor";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UserGateway } from "./user.gateway";
import { UserDataPushEvent } from "@terramatch-microservices/common/userDataPush/user-data-push.service";
import { Job } from "bullmq";
import { Server } from "socket.io";
import { TaskFactory, UserFactory, UserTaskFactory } from "@terramatch-microservices/database/factories";
import { JsonApiDocument, Resource } from "@terramatch-microservices/common/util";
import { UserTaskDto } from "@terramatch-microservices/common/dto/user-task.dto";

describe("UserSocketProcessor", () => {
  let module: TestingModule;
  let processor: UserSocketProcessor;

  const gateway = (): DeepMocked<UserGateway> => module.get(UserGateway);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [UserSocketProcessor, { provide: UserGateway, useValue: createMock<UserGateway>() }]
    }).compile();

    processor = module.get(UserSocketProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("process", () => {
    it("throws if the event is not supported", async () => {
      await expect(processor.process({ name: "foo" } as Job<UserDataPushEvent>)).rejects.toThrow(
        'Received unknown job "foo" with data undefined'
      );
    });

    it("throws if the event data is missing a user id", async () => {
      await expect(processor.process({ name: "userDataPush", data: {} } as Job<UserDataPushEvent>)).rejects.toThrow(
        "No user ID for user push event {}"
      );
    });

    it("throws if the model or model id are missing", async () => {
      await expect(
        processor.process({ name: "userDataPush", data: { userIds: [1] } } as Job<UserDataPushEvent>)
      ).rejects.toThrow('Model missing for user push event {"userIds":[1]}');
    });

    it("skips emitting if there are no connections for the user id", async () => {
      const room = {
        fetchSockets: jest.fn(() => Promise.resolve([])),
        emit: jest.fn()
      } as unknown as ReturnType<Server["in"]>;
      gateway().server.in.mockReturnValue(room);
      await processor.process({
        name: "userDataPush",
        data: { userIds: [1], model: "tasks", modelId: 2 }
      } as Job<UserDataPushEvent>);
      expect(gateway().server.in).toHaveBeenCalledWith("user:1");
      expect(room.fetchSockets).toHaveBeenCalledWith();
      expect(room.emit).not.toHaveBeenCalled();
    });

    it("generates a data document", async () => {
      const user1 = await UserFactory.create();
      const user2 = await UserFactory.create();
      const task = await TaskFactory.create();
      await UserTaskFactory.create({ userId: user1.id, taskId: task.id });
      await UserTaskFactory.create({ userId: user2.id, taskId: task.id });
      const emit = jest.fn();
      const userRoom = {
        fetchSockets: jest.fn(() => Promise.resolve([1])), // what's in the room doesn't matter to the processor
        emit
      } as unknown as ReturnType<Server["in"]>;
      const emptyRoom = {
        fetchSockets: jest.fn(() => Promise.resolve([])),
        emit: jest.fn()
      } as unknown as ReturnType<Server["in"]>;
      gateway().server.in.mockImplementation((roomName: string | string[]) =>
        roomName === `user:${user1.id}` ? userRoom : emptyRoom
      );
      await processor.process({
        name: "userDataPush",
        data: { userIds: [user1.id, user2.id], model: "tasks", modelId: task.id }
      } as Job<UserDataPushEvent>);
      expect(emptyRoom.emit).not.toHaveBeenCalled();
      expect(gateway().server.in).toHaveBeenCalledWith(`user:${user1.id}`);
      expect(gateway().server.in).toHaveBeenCalledWith(`user:${user2.id}`);
      expect(userRoom.emit).toHaveBeenCalled();

      const [event, payload] = emit.mock.calls[0] as [string, JsonApiDocument];
      expect(event).toBe("userDataPush");
      const resource = payload.data as Resource;
      expect(resource.type).toBe("userTasks");
      expect(resource.id).toBe(task.uuid);
      const dto = resource.attributes as unknown as UserTaskDto;
      expect(dto.associations.length).toBe(2);
      expect(dto.associations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userUuid: user1.uuid,
            firstName: user1.firstName,
            lastName: user1.lastName
          })
        ])
      );
      expect(dto.associations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userUuid: user2.uuid,
            firstName: user2.firstName,
            lastName: user2.lastName
          })
        ])
      );
    });

    it("generates a deletion document", async () => {
      const user = await UserFactory.create();
      const task = await TaskFactory.create();
      await UserTaskFactory.create({ userId: user.id, taskId: task.id });
      const emit = jest.fn();
      const room = {
        fetchSockets: jest.fn(() => Promise.resolve([1])), // what's in the room doesn't matter to the processor
        emit
      } as unknown as ReturnType<Server["in"]>;
      gateway().server.in.mockReturnValue(room);
      await processor.process({
        name: "userDataDelete",
        data: { userIds: [user.id], model: "tasks", modelId: task.id }
      } as Job<UserDataPushEvent>);
      expect(gateway().server.in).toHaveBeenCalledWith(`user:${user.id}`);
      expect(room.emit).toHaveBeenCalled();

      const [event, payload] = emit.mock.calls[0] as [string, JsonApiDocument];
      expect(event).toBe("userDataPush");
      expect(payload.meta.resourceType).toBe("userTasks");
      expect(payload.meta.resourceIds).toEqual([task.uuid]);
      expect(payload.data).toBeUndefined();
    });

    it("throws if the serializer is not defined", async () => {
      const user = await UserFactory.create();
      const task = await TaskFactory.create();
      await UserTaskFactory.create({ userId: user.id, taskId: task.id });
      const emit = jest.fn();
      const room = {
        fetchSockets: jest.fn(() => Promise.resolve([1])), // what's in the room doesn't matter to the processor
        emit
      } as unknown as ReturnType<Server["in"]>;
      gateway().server.in.mockReturnValue(room);
      await expect(
        processor.process({
          name: "userDataDelete",
          data: { userIds: [user.id], model: "foo", modelId: task.id }
        } as unknown as Job<UserDataPushEvent>)
      ).rejects.toThrow("Invalid model: foo");
    });
  });
});
