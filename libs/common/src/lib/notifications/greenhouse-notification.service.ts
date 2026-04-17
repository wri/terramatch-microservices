import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Media, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";

@Injectable()
export class GreenhouseNotificationService {
  private readonly logger = new TMLogger(GreenhouseNotificationService.name);

  private readonly apiUrl: string | null;
  private readonly apiToken: string | null;

  constructor(readonly configService: ConfigService) {
    this.apiUrl = configService.get<string>("GREENHOUSE_API_URL") ?? null;
    this.apiToken = configService.get<string>("GREENHOUSE_API_TOKEN") ?? null;
  }

  async notifyMediaDeletion(media: Media) {
    return this.runMutation("tmNotifyMediaDeleted", media.uuid);
  }

  async notifyPolygonUpdated(polygon: PolygonGeometry) {
    return this.runMutation("tmNotifyFeatureUpdated", polygon.uuid);
  }

  private isEnabled() {
    return this.apiUrl != null && this.apiUrl != "" && this.apiToken != null && this.apiToken != "";
  }

  private async runMutation(mutation: string, uuid: string) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const response = await fetch(this.apiUrl as string, {
        method: "POST",
        headers: {
          "api-key": this.apiToken as string,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: `mutation ($uuid: Id!) { ${mutation}(uuid: $uuid) { ok } }`,
          variables: { uuid }
        })
      });

      if (!response.ok) {
        this.logger.error(
          `Exception sending query to Greenhouse [fn=${mutation}, uuid=${uuid}]: ${await response.json()}`
        );
        return;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Exception sending query to Greenhouse [fn=${mutation}, uuid=${uuid}]: ${error}`);

      throw new InternalServerErrorException(
        `Exception sending query to Greenhouse [fn=${mutation}, uuid=${uuid}]: ${error}`
      );
    }
  }
}
