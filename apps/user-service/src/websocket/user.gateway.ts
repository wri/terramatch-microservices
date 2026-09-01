import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*"
  },
  path: "/userSockets/v3/connection"
})
export class UserGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket, ...args: any[]) {
    console.log("Connection made", { args });
  }
}
