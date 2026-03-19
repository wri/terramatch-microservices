import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Op } from "sequelize";
import { Media, Organisation, ProjectPitch } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

export const migrateConsortium = withoutSqlLogs(async (mediaService: MediaService) => {
  const builder = new PaginatedQueryBuilder(Organisation, 100)
    .where({
      consortium: { [Op.not]: null }
    })
    .attributes(["uuid", "consortium"]);
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} Organisations [:bar] :percent :etas`, { width: 40, total });
  const failedMediaCopies: { orgUuid: string; pitchUuid: string; mediaId: number; message: string }[] = [];
  for await (const page of batchFindAll(builder)) {
    for (const org of page) {
      const pitches = await ProjectPitch.findAll({
        where: { organisationId: org.uuid }
      });

      const medias = await Media.for(org).collection("consortium_partnership_agreements").findAll();
      for (const pitch of pitches) {
        await pitch.update({ consortium: org.consortium });
        for (const media of medias) {
          try {
            await mediaService.duplicateMedia(media, pitch);
          } catch (e) {
            failedMediaCopies.push({
              orgUuid: org.uuid,
              pitchUuid: pitch.uuid,
              mediaId: media.id,
              message: e.message
            });
          }
        }
      }

      bar.tick();
    }

    if (failedMediaCopies.length === 0) {
      console.log("All media copies succeeded");
    } else {
      console.log(`Failed to copy ${failedMediaCopies.length} media files:`);
      console.log(JSON.stringify(failedMediaCopies, null, 2));
    }
  }
});
