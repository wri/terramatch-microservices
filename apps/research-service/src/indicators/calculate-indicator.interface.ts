import { Polygon } from "geojson";
import { DataApiService } from "@terramatch-microservices/data-api";
import { EcoRegionResult } from "./calculators/restoration-by-eco-region.calculator";

export interface IndicatorResult {
  valid: boolean;
  extraInfo: object | null;
}

export interface CalculateIndicator {
  calculate(
    polygonUuid: string,
    geometry: Polygon,
    dataApiService: DataApiService
  ): Promise<number> | Promise<string> | Promise<EcoRegionResult>;
}
