import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, WebSocket } from "ws";
import { Injectable } from "@nestjs/common";
import { IncomingMessage } from "node:http";
import { isEmpty } from "lodash";

export type AuthenticatedSocket = WebSocket & {
  userId: number;
};

@Injectable()
@WebSocketGateway({
  path: "/userSockets/v3/connection"
})
export class UserGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: AuthenticatedSocket, request: IncomingMessage) {
    const userId = this.getUserId(request);
    console.log("websocket connection", { userId });
    if (userId == null) {
      client.terminate();
      return;
    }

    client.userId = userId;
  }

  private getUserId(request: IncomingMessage) {
    if (request.url == null) return null;

    console.log("request url", request.url);
    const url = new URL(`http://${process.env.HOST ?? "localhost"}${request.url}`);
    const token = url.searchParams.get("authToken");
    if (isEmpty(token)) return null;

    try {
      const { sub } = this.jwtService.verify(token as string);
      return (sub ?? null) as number | null;
    } catch {
      return null;
    }
  }
}
