import { Injectable } from '@nestjs/common';
import { tx, t, normalizeLocale } from "@transifex/native";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TranslationService {
  constructor(private readonly configService: ConfigService,) {
    tx.init({
      token: this.configService.get('TRANSIFEX_TOKEN'),
    });
  }

  /**
   * Translate text to the target locale.
   * @param text The text to translate.
   * @param locale The target locale (e.g., 'es', 'fr').
   * @returns The translated text.
   */
  async translate(text: string, locale: string): Promise<string> {
    // Set the locale for the SDK

    const txLocale = normalizeLocale(locale);

    await tx.setCurrentLocale(txLocale);

    // Translate the text
    return t(text);
  }
}
