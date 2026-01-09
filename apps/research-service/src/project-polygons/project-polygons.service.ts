import { Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { Op, Transaction } from "sequelize";
import { FeatureCollection, Geometry } from "geojson";
import { ProjectPolygonGeoJsonQueryDto } from "./dto/project-polygon-geojson-query.dto";

@Injectable()
export class ProjectPolygonsService {
  private readonly logger = new Logger(ProjectPolygonsService.name);

  async findByProjectPitchUuid(projectPitchUuid: string): Promise<ProjectPolygon | null> {
    const projectPitch = await ProjectPitch.findOne({
      where: { uuid: projectPitchUuid },
      attributes: ["id", "uuid"]
    });

    if (projectPitch == null) {
      return null;
    }

    const projectPolygon = await ProjectPolygon.findOne({
      where: {
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      },
      include: [
        {
          model: PolygonGeometry,
          attributes: ["uuid"]
        }
      ]
    });

    return projectPolygon;
  }

  async loadProjectPitchAssociation(projectPolygons: ProjectPolygon[]): Promise<Record<number, string>> {
    if (projectPolygons.length === 0) {
      return {};
    }

    const entityIds = projectPolygons
      .filter(pp => pp.entityType === ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH)
      .map(pp => pp.entityId);

    if (entityIds.length === 0) {
      return {};
    }

    const projectPitches = await ProjectPitch.findAll({
      where: { id: { [Op.in]: entityIds } },
      attributes: ["id", "uuid"]
    });

    return projectPitches.reduce(
      (mapping, pitch) => ({
        ...mapping,
        [pitch.id]: pitch.uuid
      }),
      {} as Record<number, string>
    );
  }

  async buildDto(projectPolygon: ProjectPolygon, projectPitchUuid?: string): Promise<ProjectPolygonDto> {
    let finalProjectPitchUuid: string | null = null;

    if (projectPitchUuid != null) {
      finalProjectPitchUuid = projectPitchUuid;
    } else if (projectPolygon.entityType === ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH) {
      const projectPitch = await ProjectPitch.findByPk(projectPolygon.entityId, {
        attributes: ["uuid"]
      });
      finalProjectPitchUuid = projectPitch?.uuid ?? null;
    }

    const dto = new ProjectPolygonDto(projectPolygon, finalProjectPitchUuid);
    return dto;
  }

  async transaction<TReturn>(callback: (transaction: Transaction) => Promise<TReturn>) {
    if (ProjectPolygon.sequelize == null) {
      throw new InternalServerErrorException("Database connection not available");
    }

    const transaction = await ProjectPolygon.sequelize.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  async deleteProjectPolygon(projectPolygon: ProjectPolygon): Promise<string> {
    return await this.transaction(async transaction => {
      return await this.deleteProjectPolygonAndGeometry(projectPolygon, transaction);
    });
  }

  async deleteProjectPolygonAndGeometry(projectPolygon: ProjectPolygon, transaction: Transaction): Promise<string> {
    const polygonUuid = projectPolygon.polyUuid;
    const uuid = projectPolygon.uuid;

    await ProjectPolygon.destroy({
      where: { uuid },
      transaction
    });
    this.logger.log(`Deleted ProjectPolygon ${uuid}`);

    await PolygonGeometry.destroy({
      where: { uuid: polygonUuid },
      transaction
    });
    this.logger.log(`Deleted PolygonGeometry ${polygonUuid}`);

    return uuid;
  }

  async findOne(uuid: string): Promise<ProjectPolygon | null> {
    return await ProjectPolygon.findOne({
      where: { uuid },
      attributes: ["id", "uuid", "polyUuid", "entityId", "entityType", "createdBy"]
    });
  }

  async findByPolyUuid(polyUuid: string): Promise<ProjectPolygon | null> {
    return await ProjectPolygon.findOne({
      where: { polyUuid },
      attributes: ["id", "uuid", "polyUuid", "entityId", "entityType", "createdBy"]
    });
  }

  async getGeoJson(query: ProjectPolygonGeoJsonQueryDto): Promise<FeatureCollection> {
    const projectPitch = await ProjectPitch.findOne({
      where: { uuid: query.projectPitchUuid },
      attributes: ["id", "uuid"]
    });

    if (projectPitch == null) {
      throw new NotFoundException(`Project pitch not found for uuid: ${query.projectPitchUuid}`);
    }

    const projectPolygon = await ProjectPolygon.findOne({
      where: {
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      },
      attributes: ["polyUuid"]
    });

    if (projectPolygon == null) {
      throw new NotFoundException(`Project polygon not found for project pitch: ${query.projectPitchUuid}`);
    }

    if (projectPolygon.polyUuid == null) {
      throw new NotFoundException(`Polygon geometry UUID not found for project polygon`);
    }

    const geoJsonString = await PolygonGeometry.getGeoJSON(projectPolygon.polyUuid);
    if (geoJsonString == null) {
      throw new NotFoundException(`Polygon geometry not found for uuid: ${projectPolygon.polyUuid}`);
    }

    let geometry: Geometry;
    try {
      geometry = JSON.parse(geoJsonString) as Geometry;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to parse geometry JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry,
          properties: {
            projectPitchUuid: query.projectPitchUuid
          }
        }
      ]
    };
  }
}
