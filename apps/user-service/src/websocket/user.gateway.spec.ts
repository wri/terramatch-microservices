import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UserGateway } from "./user.gateway";
import { Server, Socket } from "socket.io";
import { UserFactory, UserTaskFactory } from "@terramatch-microservices/database/factories";
import { JsonApiDocument, Resource } from "@terramatch-microservices/common/util";
import { isArray } from "lodash";

describe("UserGateway", () => {
  let module: TestingModule;
  let gateway: UserGateway;

  const jwtService = (): DeepMocked<JwtService> => module.get(JwtService);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        UserGateway,
        {
          provide: JwtService,
          useValue: createMock<JwtService>()
        }
      ]
    }).compile();

    gateway = module.get(UserGateway);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("afterInit middleware", () => {
    let middleware: (socket: Socket, next: (err?: Error) => void) => void;

    beforeEach(() => {
      const serverUse = jest.fn();
      const server = { use: serverUse } as unknown as Server;
      gateway.afterInit(server);
      middleware = serverUse.mock.calls[0][0] as (socket: Socket, next: (err?: Error) => void) => void;
    });

    it("sends an error when the user is not authenticated", () => {
      const next = jest.fn();
      middleware({} as Socket, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
    });

    it("sends an error when JWT verification fails", () => {
      jwtService().verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      const next = jest.fn();
      middleware({ handshake: { auth: { token: "Bearer asdfasdf" } } } as unknown as Socket, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
    });

    it("attaches the user ID when the user is authenticated", () => {
      jwtService().verify.mockImplementation(() => ({ sub: 1 }));
      const next = jest.fn();
      const data = { userId: null };
      const join = jest.fn();
      middleware({ data, join, handshake: { auth: { token: "Bearer asdfasdf" } } } as unknown as Socket, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(join).toHaveBeenCalledTimes(1);
      expect(join).toHaveBeenCalledWith("user:1");
      expect(data.userId).toBe(1);
    });
  });

  describe("handleConnection", () => {
    it("throws if the socket is missing a user id", async () => {
      await expect(gateway.handleConnection({ data: {} } as unknown as Socket)).rejects.toThrow(
        "User ID missing on client socket"
      );
    });

    it("emits the user's current tasks", async () => {
      const user = await UserFactory.create();
      const userTask = await UserTaskFactory.create({ userId: user.id });
      const emit = jest.fn();
      await gateway.handleConnection({ data: { userId: user.id }, emit } as unknown as Socket);
      expect(emit).toHaveBeenCalledTimes(1);
      const [event, payload] = emit.mock.calls[0] as [string, JsonApiDocument];
      expect(event).toBe("userDataReset");
      expect(payload.meta.resourceType).toBe("userTasks");
      expect(isArray(payload.data)).toBe(false);
      const resource = payload.data as Resource;
      expect(resource.type).toBe("userTasks");
      expect(resource.id).toBe((await userTask.$get("task", { attributes: ["uuid"] }))?.uuid);
    });
  });
});
