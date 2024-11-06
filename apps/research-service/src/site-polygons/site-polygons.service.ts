import { BadRequestException, Injectable } from "@nestjs/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Attributes, FindOptions, Op, WhereOptions } from "sequelize";

class SitePolygonQueryBuilder {
  private findOptions: FindOptions<Attributes<SitePolygon>> = {};

  constructor(pageSize: number) {
    this.findOptions.limit = pageSize;
  }

  async pageAfter(pageAfter: string) {
    const sitePolygon = await SitePolygon.findOne({ where: { uuid: pageAfter }, attributes: ["id"] });
    if (sitePolygon == null) throw new BadRequestException("pageAfter polygon not found");
    this.where({ id: { [Op.gt]: sitePolygon.id } });
    return this;
  }

  async execute(): Promise<SitePolygon[]> {
    return await SitePolygon.findAll(this.findOptions);
  }

  private where(options: WhereOptions) {
    if (this.findOptions.where == null) this.findOptions.where = {};
    Object.assign(this.findOptions.where, options);
  }
}

@Injectable()
export class SitePolygonsService {
  async buildQuery(pageSize: number, pageAfter?: string) {
    const builder = new SitePolygonQueryBuilder(pageSize);
    if (pageAfter != null) await builder.pageAfter(pageAfter);
    return builder;
  }
}
