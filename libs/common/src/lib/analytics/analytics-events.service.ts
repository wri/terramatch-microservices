import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmpty } from "lodash";
import { TMLogger } from "../util/tm-logger";

@Injectable()
export class AnalyticsEventService {
  private readonly analyticsUrl: string;
  private readonly logger = new TMLogger(AnalyticsEventService.name);

  constructor(readonly configService: ConfigService) {
    const apiSecret = configService.get<string>("GA_API_SECRET");
    const measurementId = configService.get<string>("GA_MEASUREMENT_ID");
    if (!isEmpty(apiSecret) && !isEmpty(measurementId)) {
      this.analyticsUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    }
  }

  async sendEvent(modelUuid: string, eventName: string, params: object) {
    if (this.analyticsUrl == null) {
      this.logger.log(`Analytics URL not configured, skipping GA event: ${eventName} for ${modelUuid}`);
      return;
    }

    this.logger.log(`Sending GA event: ${eventName} for ${modelUuid}`);
    const response = await fetch(this.analyticsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: modelUuid,
        events: [{ name: eventName, params }]
      })
    });

    if (!response.ok) {
      this.logger.error(`Failed to send GA event: ${await response.json()}`);
    }
  }
}
