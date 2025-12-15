import { EmailSender } from "./email-sender";
import { EmailService } from "./email.service";
import { Site, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { Queue } from "bullmq";
import { Dictionary } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";

type PolygonClippingCompleteEmailData = {
  userId: number;
  siteUuid?: string;
  polygonUuids?: string[];
  completedAt: Date;
};

export class PolygonClippingCompleteEmail extends EmailSender {
  private readonly logger = new TMLogger(PolygonClippingCompleteEmail.name);

  private readonly userId: number;
  private readonly siteUuid?: string;
  private readonly polygonUuids?: string[];
  private readonly completedAt: Date;

  constructor({ userId, siteUuid, polygonUuids, completedAt }: PolygonClippingCompleteEmailData) {
    super();
    this.userId = userId;
    this.siteUuid = siteUuid;
    this.polygonUuids = polygonUuids;
    this.completedAt = completedAt instanceof Date ? completedAt : new Date(completedAt);
  }

  async sendLater(queue: Queue) {
    await queue.add("polygonClippingComplete", {
      userId: this.userId,
      siteUuid: this.siteUuid,
      polygonUuids: this.polygonUuids,
      completedAt: this.completedAt
    });
  }

  async send(emailService: EmailService) {
    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["uuid", "emailAddress", "firstName", "lastName", "locale"]
    });

    if (user == null) {
      this.logger.error(`User not found [${this.userId}]`);
      return;
    }

    if (user.emailAddress == null) {
      this.logger.error(`User has no email address [${this.userId}]`);
      return;
    }

    let targetSiteUuid = this.siteUuid;

    if (targetSiteUuid == null && this.polygonUuids != null && this.polygonUuids.length > 0) {
      const sitePolygons = await SitePolygon.findAll({
        where: {
          polygonUuid: this.polygonUuids,
          isActive: true
        },
        attributes: ["siteUuid"]
      });

      const uniqueSiteUuids = [...new Set(sitePolygons.map(sp => sp.siteUuid).filter(isNotNull))];

      if (uniqueSiteUuids.length === 1) {
        targetSiteUuid = uniqueSiteUuids[0];
      } else {
        this.logger.log(
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

    const completedTime = this.formatTime(this.completedAt);

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

    this.logger.log(`Sent polygon clipping complete email to user ${this.userId} for site ${targetSiteUuid}`);
  }

  private formatTime(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes} GMT`;
  }
}
