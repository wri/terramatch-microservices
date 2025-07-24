import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardSitePolygonsService } from "./dashboard-sitepolygons.service";
import { DashboardSitePolygonsLightDto } from "./dto/dashboard-sitepolygons.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";

@Controller("dashboard/v3/dashboardSitepolygons")
export class DashboardSitePolygonsController {
  constructor(private readonly dashboardSitePolygonsService: DashboardSitePolygonsService) {}

  @Get()
  @JsonApiResponse(DashboardSitePolygonsLightDto)
  @ApiOperation({ operationId: "getDashboardSitePolygons", summary: "Get dashboard site polygons" })
  async getDashboardSitePolygons(
    @Query("polygonStatus") polygonStatus?: string[],
    @Query("projectUuid") projectUuid?: string
  ) {
    const polygonStatusArr = Array.isArray(polygonStatus) ? polygonStatus : undefined;

    const data = await this.dashboardSitePolygonsService.getDashboardSitePolygons({
      polygonStatus: polygonStatusArr,
      projectUuid
    });

    const document = buildJsonApi(DashboardSitePolygonsLightDto);
    data.forEach((sitePolygon: DashboardSitePolygonsLightDto) => {
      document.addData(sitePolygon.uuid, sitePolygon);
    });
    return document.serialize();
  }
}
