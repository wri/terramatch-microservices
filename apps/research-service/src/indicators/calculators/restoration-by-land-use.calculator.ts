import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";

export class RestorationByLandUseCalculator implements CalculateIndicator {
  async calculate(polygonUuid: string, geometry: Polygon, dataApiService: DataApiService): Promise<number> {
    return Promise.resolve(0);
  }
}
