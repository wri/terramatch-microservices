import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import {
  Form,
  FormQuestion,
  Project,
  Tracking,
  TrackingEntry,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { Op } from "sequelize";
import { Dictionary } from "lodash";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { EmbeddedTrackingDto } from "@terramatch-microservices/common/dto/tracking.dto";

export const moveTrackingDataTreesGoal = withoutSqlLogs(async () => {
  await processTrackings();
  await processUpdateRequests();
});

const processTrackings = async () => {
  const builder = new PaginatedQueryBuilder(Tracking, 10, [{ association: "entries" }]).where({ type: "trees-goal" });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} trees-goal trackings [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const tracking of page) {
      const yearEntries = (tracking.entries ?? []).filter(({ type }) => type === "years");
      if (yearEntries.length > 0) {
        const { domain, collection, hidden, trackableType, trackableId } = tracking;
        const treePlantedGoal = await Tracking.create({
          domain,
          collection,
          trackableType,
          trackableId,
          hidden,
          type: "trees-planted-goal"
        });

        await TrackingEntry.update(
          { trackingId: treePlantedGoal.id },
          { where: { id: yearEntries.map(({ id }) => id) } }
        );
      }

      bar.tick();
    }
  }
};

const processUpdateRequests = async () => {
  const forms: Dictionary<Form | null> = {};
  const formQuestionUuids: Dictionary<{ treesGoal: string | null; treesPlantedGoal: string | null }> = {};
  const findFormQuestions = async (frameworkKey: FrameworkKey | null) => {
    if (frameworkKey == null) return null;

    if (formQuestionUuids[frameworkKey] != null) return formQuestionUuids[frameworkKey];

    const form = (forms[frameworkKey] ??= await Form.findOne({ where: { frameworkKey, model: Project.LARAVEL_TYPE } }));
    if (form == null) return null;

    const treesGoal = await FormQuestion.forForm(form.uuid).findOne({ where: { inputType: "treesGoal" } });
    const treesPlantedGoal = await FormQuestion.forForm(form.uuid).findOne({
      where: { inputType: "treesPlantedGoal" }
    });
    return (formQuestionUuids[frameworkKey] = {
      treesGoal: treesGoal?.uuid ?? null,
      treesPlantedGoal: treesPlantedGoal?.uuid ?? null
    });
  };

  const builder = new PaginatedQueryBuilder(UpdateRequest, 10).where({
    status: { [Op.ne]: APPROVED },
    updateRequestableType: Project.LARAVEL_TYPE
  });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} project update requests [:bar] :percent :etas`, {
    width: 40,
    total
  });
  for await (const page of batchFindAll(builder)) {
    for (const updateRequest of page) {
      const uuids = await findFormQuestions(updateRequest.frameworkKey);
      if (uuids?.treesGoal == null || uuids?.treesPlantedGoal == null) {
        bar.tick();
        continue;
      }

      const treesGoalContent = updateRequest.content?.[uuids.treesGoal];
      if (!Array.isArray(treesGoalContent) || treesGoalContent.length !== 1) {
        bar.tick();
        continue;
      }

      const data = treesGoalContent[0] as EmbeddedTrackingDto;
      const years = data.entries.filter(({ type }) => type === "years");
      if (years.length === 0) {
        bar.tick();
        continue;
      }

      const content = { ...updateRequest.content };
      content[uuids.treesGoal] = [
        {
          ...data,
          entries: data.entries.filter(({ type }) => type !== "years")
        }
      ];
      content[uuids.treesPlantedGoal] = [
        {
          domain: "restoration",
          type: "trees-planted-goal",
          collection: "all",
          entries: years
        }
      ];
      await updateRequest.update({ content });

      bar.tick();
    }
  }
};
