import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { USER_DATA_SERIALIZERS } from "./user-data-serializers";

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*"
  },
  path: "/userSockets/v3/connection"
})
export class UserGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly jwtService: JwtService) {}

  // Install middleware to authenticate users and add them to a "room" for their user events.
  afterInit(server: Server) {
    server.use((socket: Socket, next) => {
      const userId = this.getUserId(socket);
      if (userId == null) {
        next(new Error("Unauthorized"));
      } else {
        socket.join(`user:${userId}`);
        socket.data.userId = userId;
        next();
      }
    });
  }

  async handleConnection(client: Socket) {
    if (client.data.userId == null) {
      throw new InternalServerErrorException("User ID missing on client socket");
    }

    for (const serializer of Object.values(USER_DATA_SERIALIZERS)) {
      const models = await serializer.findForUser(client.data.userId);
      if (models.length > 0) {
        client.emit("userDataReset", (await serializer.addDtos(serializer.createDocument(), models)).serialize());
      }
    }
  }

  private getUserId(socket: Socket) {
    const [type, token] = socket.handshake?.auth?.token?.split(" ") ?? [];
    if (type !== "Bearer" || token == null) {
      return null;
    }

    try {
      const { sub } = this.jwtService.verify(token);
      return (sub ?? null) as number | null;
    } catch {
      return null;
    }
  }
}
