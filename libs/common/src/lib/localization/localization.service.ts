import { Injectable } from "@nestjs/common";
import { i18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { i18nItem } from "@terramatch-microservices/database/entities/i18n-item.entity";
import { Op } from "sequelize";


@Injectable()
export class LocalizationService {

  async getLocalizationKeys(keys: string[]): Promise<LocalizationKey[]> {
    return await LocalizationKey.findAll({ where: { key: { [Op.in]: keys } } });
  }

  private async getItemI18n(value: string): Promise<i18nItem | null> {
    return await i18nItem.findOne({
      where: {
        [Op.or]: [
          { shortValue: value },
          { longValue: value }
        ]
      }
    });
  }

  private async getTranslateItem(itemId: number, locale: string): Promise<i18nTranslation | null> {
    return await i18nTranslation.findOne({where: { i18nItemId: itemId, language: locale}});
  }

  async translate(content: string, locale: string): Promise<string | null> {
    const itemResult = await this.getItemI18n(content)
    if (itemResult == null) {
      return content;
    }
    const translationResult = await this.getTranslateItem(itemResult.id, locale);
    if (translationResult == null) {
      return content;
    }
    return translationResult.shortValue || translationResult.longValue;
  }

}
