import { FormQuestion } from "@terramatch-microservices/database/entities";
import { col, Op, where } from "sequelize";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { camelCase, groupBy } from "lodash";
import pluralize from "pluralize";
import ProgressBar from "progress";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { ENTITY_MODELS, EntityType } from "@terramatch-microservices/database/constants/entities";

export const useQuestionName = withoutSqlLogs(async () => {
  // Find questions that are not in a deleted section or form and have a name that matches a UUID regex while
  // also having a name that is not equal to its own UUID.
  const questions = groupBy(
    await FormQuestion.findAll({
      where: {
        [Op.and]: [
          where(col("FormQuestion.uuid"), Op.ne, col("FormQuestion.name")),
          {
            name: { [Op.regexp]: "^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$" }
          }
        ]
      },
      attributes: ["inputType", "name", "uuid"],
      include: [
        {
          association: "formSection",
          required: true,
          attributes: ["formId", "id"],
          include: [
            {
              association: "form",
              attributes: ["uuid", "type", "title"],
              required: true
            }
          ]
        }
      ]
    }),
    "formSection.form.uuid"
  );

  for (const formQuestions of Object.values(questions)) {
    await fixEntities(formQuestions);
  }
});

const fixEntities = async (formQuestions: FormQuestion[]) => {
  const { type: formType, uuid, title: formTitle } = formQuestions[0]?.formSection?.form ?? {};
  if (formType == null || formQuestions.find(q => q.formSection?.form?.type !== formType) != null) {
    throw new Error(`Invalid set of form questions for form type [${formType}]`);
  }

  const entityModel = ENTITY_MODELS[camelCase(pluralize(formType)) as EntityType];
  if (entityModel == null) {
    throw new Error(`Unable to find model for form type [${formType}]`);
  }

  const conditionalQuestions = formQuestions.filter(q => q.inputType === "conditional");
  if (conditionalQuestions.length > 0) {
    const builder = new PaginatedQueryBuilder(entityModel, 10);
    const total = await builder.paginationTotal();
    const bar = new ProgressBar(
      `Processing ${total} ${pluralize(formType)} for form ${uuid} - ${formTitle}: [:bar] :percent :etas`,
      {
        width: 40,
        total
      }
    );
    for await (const page of batchFindAll(builder)) {
      for (const entity of page) {
        let needsUpdate = false;
        const answers = { ...(entity.answers ?? {}) };
        for (const { name, uuid } of conditionalQuestions) {
          if (uuid in answers) {
            needsUpdate = true;
            answers[name as string] = answers[uuid];
            delete answers[uuid];
          }
        }
        if (needsUpdate) {
          // @ts-expect-error working around "not callable" error
          await entity.update({ answers });
        }
        bar.tick();
      }
    }
  }

  // TODO: update update requests
};
