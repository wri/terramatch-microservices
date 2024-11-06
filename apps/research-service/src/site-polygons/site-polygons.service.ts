import { Injectable } from '@nestjs/common';

class SitePolygonQueryBuilder {
  constructor(private readonly pageSize: number, private readonly pageAfter?: string) {}
}

@Injectable()
export class SitePolygonsService {
  buildQuery(pageSize: number, pageAfter?: string): SitePolygonQueryBuilder {
    return new SitePolygonQueryBuilder(pageSize, pageAfter);
  }
}
