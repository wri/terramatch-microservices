import { BoundingBoxService } from "../bounding-boxes/bounding-box.service";
import {
  GwcLayer,
  GwcTileInvalidationService
} from "@terramatch-microservices/common/gwc/gwc-tile-invalidation.service";

type InvalidatePolygonTileCacheArgs = {
  boundingBoxService: BoundingBoxService;
  gwcTileInvalidationService: GwcTileInvalidationService;
  polygonUuids: string[];
  layers: GwcLayer[];
  onError: (error: unknown) => void;
};

export const invalidatePolygonTileCache = async ({
  boundingBoxService,
  gwcTileInvalidationService,
  polygonUuids,
  layers,
  onError
}: InvalidatePolygonTileCacheArgs): Promise<void> => {
  if (polygonUuids.length === 0 || layers.length === 0) return;

  try {
    const { bbox } = await boundingBoxService.getPolygonsBoundingBox(polygonUuids);
    await gwcTileInvalidationService.truncate(bbox, layers);
  } catch (error) {
    onError(error);
  }
};
