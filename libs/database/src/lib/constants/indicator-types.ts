export interface TreeCoverLossResult {
  umd_tree_cover_loss__year: number;
  area__ha: number;
}

export interface TreeCoverLossFiresResult {
  umd_tree_cover_loss_from_fires__year: number;
  area__ha: number;
}

export interface EcoRegionResult {
  [key: string]: string | number;
  realm: string;
}

export interface TreeCoverLossData {
  [key: string]: number;
}

export interface RestorationByTypeData {
  [key: string]: number;
}
