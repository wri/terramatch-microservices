import { Polygon } from "geojson";
import { DataApiService } from "@terramatch-microservices/data-api";

export interface IndicatorResult {
  valid: boolean;
  extraInfo: object | null;
}

export interface CalculateIndicator {
  calculate(polygonUuid: string, geometry: Polygon, dataApiService: DataApiService): Promise<number>;
}
