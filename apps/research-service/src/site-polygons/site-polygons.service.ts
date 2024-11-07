import { BadRequestException, Injectable, Type } from "@nestjs/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Attributes, FindOptions, Op, WhereOptions } from "sequelize";
import { IndicatorDto } from "./dto/site-polygon.dto";
import { INDICATOR_DTOS } from "./dto/indicators.dto";
import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { pick } from "lodash";

class SitePolygonQueryBuilder {
  private findOptions: FindOptions<Attributes<SitePolygon>> = {
    include: [
      "indicatorsFieldMonitoring",
      "indicatorsHectares",
      "indicatorsMsuCarbon",
      "indicatorsTreeCount",
      "indicatorsTreeCover",
      "indicatorsTreeCoverLoss"
    ]
  };

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

  async convertIndicators(sitePolygon: SitePolygon): Promise<IndicatorDto[]> {
    const accessor = new ModelPropertiesAccessor();
    const indicators: IndicatorDto[] = [];
    for (const indicator of await sitePolygon.getIndicators()) {
      const DtoPrototype = INDICATOR_DTOS[indicator.indicatorSlug];
      const fields = accessor.getModelProperties(DtoPrototype as unknown as Type<unknown>);
      indicators.push(pick(indicator, fields) as typeof DtoPrototype);
    }

    return indicators;
  }
}
