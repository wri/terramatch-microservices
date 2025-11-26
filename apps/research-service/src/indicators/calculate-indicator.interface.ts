import { DataApiService } from "@terramatch-microservices/data-api";
import { IndicatorOutputHectares, IndicatorOutputTreeCoverLoss } from "@terramatch-microservices/database/entities";
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
  ): Promise<number | string | IndicatorOutputHectares | IndicatorOutputTreeCoverLoss>;
}
