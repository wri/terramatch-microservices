import { FormQuestionOption, FormTableHeader, Media } from "../entities";

export const removeQuestionDependencies = async (questionIds: number[]) => {
  // hooks won't fire on these bulk destroys, so we need to take care of media removal manually.
  const optionIds = (
    await FormQuestionOption.findAll({ where: { formQuestionId: questionIds }, attributes: ["id"] })
  ).map(({ id }) => id);
  if (optionIds.length > 0) {
    await Media.destroy({ where: { modelType: FormQuestionOption.LARAVEL_TYPE, modelId: optionIds } });
    await FormQuestionOption.destroy({ where: { formQuestionId: questionIds } });
  }

  await FormTableHeader.destroy({ where: { formQuestionId: questionIds } });
};
