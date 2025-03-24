import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebClient } from "@slack/web-api";

@Injectable()
export class SlackService {
  private _client: WebClient;
  private readonly _token: string | undefined;

  constructor(readonly configService: ConfigService) {
    this._token = configService.get<string>("SLACK_API_KEY");
  }

  private get client() {
    if (this._token == null || this._client != null) return this._client;

    return (this._client = new WebClient(this._token));
  }

  public async sendTextToChannel(message: string, channel: string) {
    return await this.client?.chat.postMessage({ text: message, channel });
  }
}
