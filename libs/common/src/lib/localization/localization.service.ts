import { Injectable } from "@nestjs/common";
import { i18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { i18nItem } from "@terramatch-microservices/database/entities/i18n-item.entity";
import { TranslationService } from './translation.service';


@Injectable()
export class LocalizationService {

  constructor(
    private readonly translationService: TranslationService) {}


  async getLocalizationKey(key: string): Promise<LocalizationKey | null> {
    return await LocalizationKey.findOne({where: { key}});
  }

  async getItemI18n(value: string): Promise<i18nItem | null> {
    return await i18nItem.findOne({where: { shortValue: value}});
  }

  async getTranslateItem(itemId: number, locale: string): Promise<i18nTranslation | null> {
    return await i18nTranslation.findOne({where: { i18nItemId: itemId, language: locale}});
  }

  async translate(key: string, locale: string): Promise<string> {
    return await this.translationService.translate(key, locale);
  }

}
