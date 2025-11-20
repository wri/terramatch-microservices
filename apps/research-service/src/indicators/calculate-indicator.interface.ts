import { DataApiService } from "@terramatch-microservices/data-api";
import { IndicatorOutputHectares } from "@terramatch-microservices/database/entities";
import { EcoRegionResult } from "@terramatch-microservices/database/constants";
import { Polygon } from "geojson";

export interface IndicatorResult {
  valid: boolean;
  extraInfo: object | null;
}

export interface CalculateIndicator {
  calculate(
    polygonUuid: string,
    geometry: Polygon,
    dataApiService: DataApiService
  ): Promise<number> | Promise<string> | Promise<EcoRegionResult> | Promise<IndicatorOutputHectares>;
}
