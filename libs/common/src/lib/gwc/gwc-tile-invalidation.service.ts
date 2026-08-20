import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TMLogger } from "../util/tm-logger";
import {
  LngLatEnvelope,
  MercatorEnvelope,
  padEnvelopeForMetatiles,
  parseLngLatEnvelope,
  toWebMercator
} from "./gwc-envelope.util";

export type GwcLayer = "active" | "deleted";

const LAYER_NAMES: Record<GwcLayer, string> = {
  active: "polygon_geometry_active",
  deleted: "polygon_geometry_deleted"
};

const GRID_SET_ID = "EPSG:900913";
const MVT_FORMAT = "application/vnd.mapbox-vector-tile";
const PAD_TILE_WIDTHS = 4;
const REQUEST_TIMEOUT_MS = 5_000;

type ZoomBand = { zoomStart: number; zoomStop: number; padZoom: number };

const ZOOM_BANDS: ZoomBand[] = [
  { zoomStart: 4, zoomStop: 11, padZoom: 4 },
  { zoomStart: 12, zoomStop: 22, padZoom: 12 }
];

@Injectable()
export class GwcTileInvalidationService {
  private readonly logger = new TMLogger(GwcTileInvalidationService.name);

  private readonly baseUrl: string | null;
  private readonly workspace: string | null;
  private readonly authHeader: string | null;

  constructor(configService: ConfigService) {
    const url = configService.get<string>("GEOSERVER_URL");
    this.baseUrl = url != null && url.length > 0 ? url.replace(/\/+$/, "") : null;

    const workspace = configService.get<string>("GEOSERVER_WORKSPACE");
    this.workspace = workspace != null && workspace.length > 0 ? workspace : null;

    const user = configService.get<string>("GEOSERVER_USER");
    const password = configService.get<string>("GEOSERVER_PASSWORD");
    this.authHeader =
      user != null && user.length > 0 && password != null && password.length > 0
        ? `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
        : null;
  }

  private isEnabled(): boolean {
    return this.baseUrl != null && this.workspace != null;
  }

  async truncate(bboxLngLat: LngLatEnvelope | number[], layers: GwcLayer[]): Promise<void> {
    if (!this.isEnabled() || layers.length === 0) return;

    const bbox = parseLngLatEnvelope(bboxLngLat);
    if (bbox == null) {
      this.logger.error(`Invalid bbox for GWC truncate: ${JSON.stringify(bboxLngLat)}`);
      return;
    }

    const merc = toWebMercator(bbox);
    const requests = ZOOM_BANDS.flatMap(band => {
      const envelope = padEnvelopeForMetatiles(merc, { padZoom: band.padZoom, padTileWidths: PAD_TILE_WIDTHS });
      return layers.map(layer => this.truncateLayer(layer, envelope, band.zoomStart, band.zoomStop));
    });

    await Promise.all(requests);
  }

  private async truncateLayer(
    layer: GwcLayer,
    envelope: MercatorEnvelope,
    zoomStart: number,
    zoomStop: number
  ): Promise<void> {
    const layerName = `${this.workspace}:${LAYER_NAMES[layer]}`;
    const url = `${this.baseUrl}/gwc/rest/seed/${layerName}.xml`;
    const body = this.buildSeedRequestXml(layerName, envelope, zoomStart, zoomStop);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = { "Content-Type": "text/xml" };
      if (this.authHeader != null) headers["Authorization"] = this.authHeader;

      const response = await fetch(url, { method: "POST", headers, body, signal: controller.signal });

      if (!response.ok) {
        this.logger.error(
          `GWC truncate request failed [layer=${layerName}, zoom=${zoomStart}-${zoomStop}, status=${response.status}]: ${await response.text()}`
        );
      }
    } catch (error) {
      this.logger.error(`Exception truncating GWC layer ${layerName} [zoom=${zoomStart}-${zoomStop}]`, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildSeedRequestXml(
    layerName: string,
    [minX, minY, maxX, maxY]: MercatorEnvelope,
    zoomStart: number,
    zoomStop: number
  ): string {
    return [
      "<seedRequest>",
      `<name>${layerName}</name>`,
      "<bounds><coords>",
      `<double>${minX}</double><double>${minY}</double><double>${maxX}</double><double>${maxY}</double>`,
      "</coords></bounds>",
      `<gridSetId>${GRID_SET_ID}</gridSetId>`,
      `<zoomStart>${zoomStart}</zoomStart>`,
      `<zoomStop>${zoomStop}</zoomStop>`,
      `<format>${MVT_FORMAT}</format>`,
      "<type>truncate</type>",
      "<threadCount>1</threadCount>",
      "</seedRequest>"
    ].join("");
  }
}
