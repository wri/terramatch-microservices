import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { pick } from "lodash";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { LandscapeGeometry, Project, ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Op } from "sequelize";
import { ResearchTreeCountQueryDto } from "./dto/research-tree-count-query.dto";
import {
  CreateResearchTreeCountAttributes,
  ResearchTreeCountDto,
  ResearchTreeCountWithProject,
  UpdateResearchTreeCountAttributes
} from "./dto/research-tree-count.dto";

const UPDATE_ATTRIBUTES = [
  "verificationMethod",
  "reportedCount",
  "treeCountAdj",
  "upperBounds",
  "lowerBounds"
] as const;

const PROJECT_INCLUDE = { association: "project", attributes: ["uuid"], required: true };

@Injectable()
export class ResearchTreeCountsService {
  async findByProjectUuid(projectUuid: string) {
    const treeCount = await ResearchTreeCount.findOne({
      include: [{ ...PROJECT_INCLUDE, where: { uuid: projectUuid } }]
    });
    if (treeCount == null) {
      throw new NotFoundException(`Tree count not found for project: ${projectUuid}`);
    }
    return treeCount as ResearchTreeCountWithProject;
  }

  async create(attributes: CreateResearchTreeCountAttributes) {
    const project = await Project.findOne({ where: { uuid: attributes.projectUuid }, attributes: ["id", "uuid"] });
    if (project == null) {
      throw new BadRequestException(`Project not found: ${attributes.projectUuid}`);
    }
    if ((await ResearchTreeCount.count({ where: { projectId: project.id } })) > 0) {
      throw new BadRequestException(`Tree count already exists for project: ${attributes.projectUuid}`);
    }

    const treeCount = await ResearchTreeCount.create({
      projectId: project.id,
      ...pick(attributes, UPDATE_ATTRIBUTES)
    });
    treeCount.project = project;
    return treeCount as ResearchTreeCountWithProject;
  }

  async update(treeCount: ResearchTreeCountWithProject, attributes: UpdateResearchTreeCountAttributes) {
    return await treeCount.update(pick(attributes, UPDATE_ATTRIBUTES));
  }

  async delete(treeCount: ResearchTreeCount) {
    await treeCount.destroy();
  }

  async addIndex(document: DocumentBuilder, query: ResearchTreeCountQueryDto) {
    const builder = PaginatedQueryBuilder.forCursorPage(ResearchTreeCount, query.page, [PROJECT_INCLUDE]);
    if (query.page?.after != null) {
      // The cursor is the project uuid, which is the resource id for tree counts.
      await builder.pageAfter(query.page.after, {
        projectId: { [Op.in]: Project.forUuid(query.page.after) }
      });
    }
    const projectIds = await this.filteredProjectIds(query);
    if (projectIds != null) builder.where({ projectId: { [Op.in]: projectIds } });
    if (query.lastModifiedDate != null) builder.where({ updatedAt: { [Op.gte]: query.lastModifiedDate } });

    const treeCounts = (await builder.execute()) as ResearchTreeCountWithProject[];
    for (const treeCount of treeCounts) {
      document.addData(treeCount.project.uuid, new ResearchTreeCountDto(treeCount));
    }

    return document.addIndex({
      requestPath: `/research/v3/treeCounts${getStableRequestQuery(query)}`,
      total: await builder.paginationTotal(),
      cursor: query.page?.after
    });
  }

  /**
   * Combines all project-level filters into a single project id subquery. Returns undefined if no
   * project-level filters were requested.
   */
  private async filteredProjectIds({
    projectId,
    projectShortNames,
    projectCohort,
    landscape
  }: ResearchTreeCountQueryDto) {
    const subquery = Subquery.select(Project, "id");
    let filtered = false;
    if (projectId != null && projectId.length > 0) {
      subquery.in("uuid", projectId);
      filtered = true;
    }
    if (projectShortNames != null && projectShortNames.length > 0) {
      subquery.in("shortName", projectShortNames);
      filtered = true;
    }
    if (projectCohort != null && projectCohort.length > 0) {
      subquery.in("cohort", projectCohort);
      filtered = true;
    }
    if (landscape != null) {
      const landscapeGeometry = await LandscapeGeometry.findOne({
        where: { slug: landscape },
        attributes: ["landscape"]
      });
      if (landscapeGeometry == null) {
        throw new BadRequestException(`Unrecognized landscape slug: ${landscape}`);
      }
      subquery.eq("landscape", landscapeGeometry.landscape);
      filtered = true;
    }

    return filtered ? subquery.literal : undefined;
  }
}
