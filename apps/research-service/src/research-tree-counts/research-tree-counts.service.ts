import { Injectable, NotFoundException } from "@nestjs/common";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Project, ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { ResearchTreeCountQueryDto } from "./dto/research-tree-count-query.dto";
import { ResearchTreeCountDto, ResearchTreeCountWithProject } from "./dto/research-tree-count.dto";

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

  async addIndex(document: DocumentBuilder, query: ResearchTreeCountQueryDto) {
    const builder = PaginatedQueryBuilder.forCursorPage(ResearchTreeCount, query.page, [PROJECT_INCLUDE]);
    if (query.page?.after != null) {
      // The cursor is the project uuid, which is the resource id for tree counts.
      await builder.pageAfter(query.page.after, {
        projectId: { [Op.in]: Project.forUuid(query.page.after) }
      });
    }
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
}
