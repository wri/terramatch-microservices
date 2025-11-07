import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { LinkedFile } from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary } from "lodash";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";
import { Media } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { isMediaOwner, mediaConfiguration } from "@terramatch-microservices/database/constants/media-owners";
import { EmbeddedMediaDto } from "../dto/media.dto";
import { FormTypeMap, ResourceCollector } from "./index";
import { mapLaravelTypes } from "./utils";

export function fileCollector(logger: LoggerService, mediaService: MediaService): ResourceCollector<LinkedFile> {
  const questions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      const key = `${modelType}:${field.property}`;
      if (questions[key] != null) logger.warn(`Duplicate file field [${modelType}, ${field.property}]`);
      questions[key] = questionUuid;
    },

    async collect(answers, models) {
      const collectionsByModel = Object.keys(questions).reduce((byModel, key) => {
        const [modelType, collection] = key.split(":") as [FormModelType, string];
        return { ...byModel, [modelType]: [...(byModel[modelType] ?? []), collection] };
      }, {} as FormTypeMap<string[]>);

      const laravelTypes = mapLaravelTypes(models);
      const medias = await Media.findAll({
        where: {
          [Op.or]: Object.entries(collectionsByModel).map(([modelType, collections]) => {
            if (models[modelType] == null) {
              throw new InternalServerErrorException(`Model for type not found: ${modelType}`);
            }
            return {
              modelType: laravelTypes[modelType],
              modelId: models[modelType].id,
              collectionName: { [Op.in]: collections }
            };
          })
        }
      });

      for (const [key, questionUuid] of Object.entries(questions)) {
        const [modelType, collection] = key.split(":") as [FormModelType, string];
        if (!isMediaOwner(modelType))
          throw new InternalServerErrorException(`Entity is not a media owner: ${modelType}`);

        const configuration = mediaConfiguration(modelType, collection);
        if (configuration == null) {
          throw new InternalServerErrorException(`Media configuration not found: [${modelType}, ${collection}]`);
        }

        const media = medias.filter(
          media => media.collectionName === collection && media.modelType === laravelTypes[modelType]
        );
        const createDto = (media: Media) =>
          new EmbeddedMediaDto(media, {
            url: mediaService.getUrl(media),
            thumbUrl: mediaService.getUrl(media, "thumbnail")
          });
        if (configuration.multiple) {
          answers[questionUuid] = media.length == 0 ? undefined : media.map(createDto);
        } else {
          if (media.length > 1) {
            logger.warn("Found multiple media for a singular media definition, returning first", {
              modelType,
              uuid: models[modelType]?.uuid,
              collection: collection
            });
          }
          answers[questionUuid] = media.length === 0 ? undefined : createDto(media[0]);
        }
      }
    }
  };
}
