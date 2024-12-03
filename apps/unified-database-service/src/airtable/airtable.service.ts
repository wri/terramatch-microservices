import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class AirtableService {
  constructor(@InjectQueue("airtable") private readonly airtableQueue: Queue) {}

  async updateAirtableJob() {
    const job = await this.airtableQueue.add("updateEntities", { test: "foo" });
    console.log("JOB", job);
  }
}
