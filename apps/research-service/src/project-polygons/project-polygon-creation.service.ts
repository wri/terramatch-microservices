import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";
import { CreateProjectPolygonBatchRequestDto, Feature } from "./dto/create-project-polygon-request.dto";
import { PolygonGeometryCreationService } from "../site-polygons/polygon-geometry-creation.service";
import { Geometry } from "@terramatch-microservices/database/constants";

@Injectable()
export class ProjectPolygonCreationService {
  constructor(private readonly polygonGeometryService: PolygonGeometryCreationService) {}

  async createProjectPolygons(request: CreateProjectPolygonBatchRequestDto, userId: number): Promise<ProjectPolygon[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new BadRequestException("Database connection not available");
    }

    const transaction = await PolygonGeometry.sequelize.transaction();
    const createdProjectPolygons: ProjectPolygon[] = [];

    try {
      const groupedByProjectPitch = this.groupGeometriesByProjectPitchId(request.geometries);

      await this.validateProjectPitchesExist(Object.keys(groupedByProjectPitch), transaction);

      for (const [projectPitchUuid, features] of Object.entries(groupedByProjectPitch)) {
        const projectPitch = await ProjectPitch.findOne({
          where: { uuid: projectPitchUuid },
          attributes: ["id", "uuid"],
          transaction
        });

        if (projectPitch == null) {
          throw new NotFoundException(`Project pitch not found: ${projectPitchUuid}`);
        }

        const existingProjectPolygon = await ProjectPolygon.findOne({
          where: {
            entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
            entityId: projectPitch.id
          },
          transaction
        });

        if (existingProjectPolygon != null) {
          throw new BadRequestException(
            `Project polygon already exists for project pitch ${projectPitchUuid}. Only one polygon per project pitch is allowed.`
          );
        }

        const geometries = features.map(f => f.geometry as Geometry);

        const { uuids: polygonUuids } = await this.polygonGeometryService.createGeometriesFromFeatures(
          geometries,
          userId,
          transaction
        );

        if (polygonUuids.length === 0) {
          throw new BadRequestException("No valid geometries were created");
        }

        const polygonUuid = polygonUuids[0];

        const projectPolygon = await ProjectPolygon.create(
          {
            polyUuid: polygonUuid,
            entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
            entityId: projectPitch.id,
            createdBy: userId,
            lastModifiedBy: userId
          } as ProjectPolygon,
          { transaction }
        );

        createdProjectPolygons.push(projectPolygon);
      }

      await transaction.commit();
      return createdProjectPolygons;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private groupGeometriesByProjectPitchId(geometries: { type: string; features: Feature[] }[]): {
    [projectPitchUuid: string]: Feature[];
  } {
    const grouped: { [projectPitchUuid: string]: Feature[] } = {};

    for (const geometryCollection of geometries) {
      if (geometryCollection.features == null) {
        continue;
      }

      for (const feature of geometryCollection.features) {
        const projectPitchUuid = feature.properties?.projectPitchUuid as string;
        if (projectPitchUuid == null) {
          throw new BadRequestException("All features must have projectPitchUuid in properties");
        }

        if (grouped[projectPitchUuid] == null) {
          grouped[projectPitchUuid] = [];
        }

        grouped[projectPitchUuid].push(feature);
      }
    }

    return grouped;
  }

  private async validateProjectPitchesExist(projectPitchUuids: string[], transaction: Transaction): Promise<void> {
    const projectPitches = await ProjectPitch.findAll({
      where: { uuid: projectPitchUuids },
      attributes: ["uuid"],
      transaction
    });

    const foundProjectPitchUuids = new Set(projectPitches.map(p => p.uuid));
    const missingProjectPitches = projectPitchUuids.filter(uuid => !foundProjectPitchUuids.has(uuid));

    if (missingProjectPitches.length > 0) {
      throw new NotFoundException(`Project pitches not found: ${missingProjectPitches.join(", ")}`);
    }
  }
}
