import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Site, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Dictionary } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { DateTime } from "luxon";

type PolygonClippingCompleteEmailData = {
  userId: number;
  siteUuid?: string;
  polygonUuids?: string[];
  completedAt: Date;
};

export class PolygonClippingCompleteEmail extends EmailSender<PolygonClippingCompleteEmailData> {
  static readonly NAME = "polygonClippingComplete";

  private readonly logger = new TMLogger(PolygonClippingCompleteEmail.name);

  constructor(data: PolygonClippingCompleteEmailData) {
    super(PolygonClippingCompleteEmail.NAME, data);
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({
      where: { id: this.data.userId },
      attributes: ["uuid", "emailAddress", "firstName", "lastName", "locale"]
    });

    if (user == null) {
      this.logger.error(`User not found [${this.data.userId}]`);
      return;
    }

    if (user.emailAddress == null) {
      this.logger.error(`User has no email address [${this.data.userId}]`);
      return;
    }

    let targetSiteUuid = this.data.siteUuid;

    if (targetSiteUuid == null && this.data.polygonUuids != null && this.data.polygonUuids.length > 0) {
      const sitePolygons = await SitePolygon.findAll({
        where: {
          polygonUuid: this.data.polygonUuids,
          isActive: true
        },
        attributes: ["siteUuid"]
      });

      const uniqueSiteUuids = [...new Set(sitePolygons.map(sp => sp.siteUuid).filter(isNotNull))];

      if (uniqueSiteUuids.length === 1) {
        targetSiteUuid = uniqueSiteUuids[0];
      } else {
        this.logger.warn(
          `Skipping email: polygons span ${uniqueSiteUuids.length} sites (email only sent for single-site operations)`
        );
        return;
      }
    }

    if (targetSiteUuid == null) {
      this.logger.error("Could not determine site UUID for clipping email");
      return;
    }

    const site = await Site.findOne({
      where: { uuid: targetSiteUuid },
      attributes: ["uuid", "name"]
    });

    if (site == null) {
      this.logger.error(`Site not found [${targetSiteUuid}]`);
      return;
    }

    const siteName = site.name ?? "Unknown Site";

    const completedTime = this.formatTime(this.data.completedAt);

    const i18nReplacements: Dictionary<string> = {
      "{siteName}": siteName,
      "{time}": completedTime
    };

    const additionalValues = {
      link: `/site/${site.uuid}`,
      transactional: "transactional"
    };

    await emailService.sendI18nTemplateEmail(
      user.emailAddress,
      user.locale,
      {
        subject: "polygon-clipping-complete.subject",
        title: "polygon-clipping-complete.title",
        body: "polygon-clipping-complete.body",
        cta: "polygon-clipping-complete.cta"
      },
      { i18nReplacements, additionalValues }
    );

    this.logger.log(`Sent polygon clipping complete email to user ${this.data.userId} for site ${targetSiteUuid}`);
  }

  private formatTime(date: Date): string {
    return DateTime.fromJSDate(date).toUTC().toFormat("HH:mm 'GMT'");
  }
}
