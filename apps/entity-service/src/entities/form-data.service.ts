import { Injectable } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import {
  DisturbanceReport,
  FinancialReport,
  Form,
  FormQuestion,
  FormSection,
  Media,
  ProjectPolygon
} from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { Dictionary } from "lodash";
import { Op } from "sequelize";
import { getLinkedFieldConfig, LinkedFieldSpecification } from "@terramatch-microservices/common/linkedFields";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { isField, isFile, isRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { isMediaOwner, mediaConfiguration } from "@terramatch-microservices/database/constants/media-owners";
import { MediaDto } from "./dto/media.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

@Injectable()
export class FormDataService {
  private logger = new TMLogger(FormDataService.name);

  constructor(private readonly localizationService: LocalizationService, private readonly mediaService: MediaService) {}

  async getForm(model: EntityModel) {
    if (model instanceof FinancialReport) {
      return await Form.findOne({ where: { type: "financial-report" } });
    }
    if (model instanceof DisturbanceReport) {
      return await Form.findOne({ where: { type: "disturbance-report" } });
    }

    return await Form.findOne({ where: { model: laravelType(model), frameworkKey: model.frameworkKey } });
  }

  async getFormTitle(form: Form, locale: ValidLocale) {
    const ids = form.titleId == null ? [] : [form.titleId];
    const translations = await this.localizationService.translateIds(ids, locale);
    return this.localizationService.translateFields(translations, form, ["title"]).title;
  }

  async getAnswers(form: Form, model: EntityModel) {
    const answers: Dictionary<unknown> = {};
    const modelAnswers = model.answers;

    const questions = await FormQuestion.findAll({
      where: { formSectionId: { [Op.in]: FormSection.forForm(form.uuid) } }
    });
    for (const question of questions) {
      const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
      if (config == null) {
        answers[question.uuid] = modelAnswers?.[question.uuid];
      } else {
        answers[question.uuid] = await this.getAnswer(config, model);
      }
    }

    return answers;
  }

  async getAnswer({ model: modelType, field }: LinkedFieldSpecification, model: EntityModel) {
    if (isField(field)) {
      if (field.inputType === "mapInput" || field.property === "proj_boundary") {
        return (
          await ProjectPolygon.findOne({
            where: { entityType: laravelType(model), entityId: model.id },
            order: [["createdAt", "DESC"]],
            include: ["polygon"]
          })
        )?.polygon;
      } else {
        return model[field.property];
      }
    } else if (isFile(field)) {
      if (!isMediaOwner(modelType)) {
        this.logger.error("Entity is not a media owner", { modelType });
        return undefined;
      }
      const configuration = mediaConfiguration(modelType, field.property);
      if (configuration == null) {
        this.logger.error("Media configuration not found", { modelType, field });
        return undefined;
      }

      const media = await Media.for(model).collection(configuration.dbCollection).findAll();
      const createDto = (media: Media) =>
        new MediaDto(media, {
          url: this.mediaService.getUrl(media),
          thumbUrl: this.mediaService.getUrl(media, "thumbnail"),
          entityType: modelType,
          entityUuid: model.uuid
        });
      if (configuration.multiple) {
        return media.length == 0 ? undefined : media.map(createDto);
      } else {
        if (media.length > 1) {
          this.logger.warn("Found multiple media for a singular media definition, returning first", {
            modelType,
            uuid: model.uuid,
            collection: configuration.dbCollection
          });
        }
        return media.length === 0 ? undefined : createDto(media[0]);
      }
    } else if (isRelation(field)) {
      // TODO
    }

    return undefined;
  }
}
