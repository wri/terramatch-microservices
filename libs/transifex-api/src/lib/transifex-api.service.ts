import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const BASE_URL = "https://rest.api.transifex.com";
const ORGANIZATION_ID = "WRI";
const PROJECT_ID = "terramatch-version-2";
const RESOURCE_ID = "terramatch-version-2";

/**
 * A service for accessing the Transifex REST API (resource strings and translations).
 */
@Injectable()
export class TransifexApiService {
  private readonly logger = new Logger(TransifexApiService.name);

  constructor(private readonly configService: ConfigService) {}

  async getTranslation(stringHash: string, locale: string) {
    const translationId = this.buildTranslationId(stringHash, locale);
    const response = await fetch(`${BASE_URL}/resource_translations/${encodeURIComponent(translationId)}`, {
      headers: this.getHeaders(),
      method: "GET"
    });

    return await this.parseResponse(response, "getTranslation");
  }

  async updateTranslation(stringHash: string, locale: string, translationText: string) {
    const translationId = this.buildTranslationId(stringHash, locale);
    const response = await fetch(`${BASE_URL}/resource_translations/${encodeURIComponent(translationId)}`, {
      headers: this.getHeaders(),
      method: "PATCH",
      body: JSON.stringify({
        data: {
          id: translationId,
          type: "resource_translations",
          attributes: {
            reviewed: true,
            strings: {
              other: translationText
            }
          }
        }
      })
    });

    return await this.parseResponse(response, "updateTranslation");
  }

  async getResourceString(key: string) {
    const params = new URLSearchParams({
      "filter[resource]": `o:${ORGANIZATION_ID}:p:${PROJECT_ID}:r:${RESOURCE_ID}`,
      "filter[key]": key
    });

    const response = await fetch(`${BASE_URL}/resource_strings?${params.toString()}`, {
      headers: this.getHeaders(),
      method: "GET"
    });

    return await this.parseResponse(response, "getResourceString");
  }

  async createResourceString(key: string, originalString: string) {
    const resourceId = this.buildResourceStringRoot();
    const response = await fetch(`${BASE_URL}/resource_strings`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        data: {
          type: "resource_strings",
          attributes: { key, context: "", strings: { other: originalString } },
          relationships: {
            resource: { data: { type: "resources", id: resourceId } }
          }
        }
      })
    });

    return await this.parseResponse(response, "createResourceString");
  }

  async updateResourceString(stringHash: string, originalString: string) {
    const resourceStringId = this.buildResourceStringId(stringHash);
    const response = await fetch(`${BASE_URL}/resource_strings/${resourceStringId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({
        data: {
          id: resourceStringId,
          type: "resource_strings",
          attributes: {
            strings: {
              other: originalString
            }
          }
        }
      })
    });

    return await this.parseResponse(response, "updateResourceString");
  }

  private buildResourceStringRoot() {
    return `o:${ORGANIZATION_ID}:p:${PROJECT_ID}:r:${RESOURCE_ID}`;
  }

  private buildResourceStringId(stringHash: string) {
    return `${this.buildResourceStringRoot()}:s:${stringHash}`;
  }

  private buildTranslationId(stringHash: string, locale: string) {
    return `${this.buildResourceStringId(stringHash)}:l:${locale}`;
  }

  private getHeaders(): Record<string, string> {
    const token = this.configService.get<string>("TRANSIFEX_API_TOKEN");
    if (token == null || token === "") {
      throw new InternalServerErrorException("TRANSIFEX_API_TOKEN is required");
    }

    return {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json"
    };
  }

  private async parseResponse(response: Response, operation: string) {
    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`${operation} failed: ${response.status} ${response.statusText}\n${error}`);
      throw new InternalServerErrorException(
        `Transifex ${operation} failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }
}
