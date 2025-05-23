import { Injectable } from "@nestjs/common";
import { TMLogger } from "../util/tm-logger";
import { Task } from "@terramatch-microservices/database/entities";

@Injectable()
export class ReportGenerationService {
  private logger = new TMLogger(ReportGenerationService.name);

  /**
   * Creates a task for the given project with the given due date, including all required
   * project, site and nursery reports.
   */
  async createTask(projectId: number, dueAt: Date) {
    if ((await Task.count({ where: { projectId, dueAt } })) > 0) {
      this.logger.warn(`Task already exists for project ${projectId} due at ${dueAt}`);
      return;
    }

    //         $task = Task::create([
    //             'organisation_id' => $project->organisation_id,
    //             'project_id' => $project->id,
    //             'status' => TaskStatusStateMachine::DUE,
    //             'period_key' => $this->period_key,
    //             'due_at' => $this->due_at,
    //         ]);
    //
    //         $projectReport = $task->projectReport()->create([
    //             'framework_key' => $this->framework_key,
    //             'project_id' => $project->id,
    //             'status' => ReportStatusStateMachine::DUE,
    //             'due_at' => $this->due_at,
    //         ]);
    //
    //         $hasSite = false;
    //         foreach ($project->nonDraftSites as $site) {
    //             $hasSite = true;
    //             $task->siteReports()->create([
    //                 'framework_key' => $this->framework_key,
    //                 'site_id' => $site->id,
    //                 'status' => ReportStatusStateMachine::DUE,
    //                 'due_at' => $this->due_at,
    //             ]);
    //         }
    //
    //         $hasNursery = false;
    //         foreach ($project->nonDraftNurseries as $nursery) {
    //             $hasNursery = true;
    //             $task->nurseryReports()->create([
    //                 'framework_key' => $this->framework_key,
    //                 'nursery_id' => $nursery->id,
    //                 'status' => ReportStatusStateMachine::DUE,
    //                 'due_at' => $this->due_at,
    //             ]);
    //         }
    //
    //         $labels = ['Project'];
    //         if ($hasSite) {
    //             $labels[] = 'site';
    //         }
    //         if ($hasNursery) {
    //             $labels[] = 'nursery';
    //         }
    //         $message = printf(
    //             '%s %s available',
    //             implode(', ', $labels),
    //             count($labels) > 1 ? 'reports' : 'report'
    //         );
    //
    //         Action::create([
    //             'status' => Action::STATUS_PENDING,
    //             'targetable_type' => ProjectReport::class,
    //             'targetable_id' => $projectReport->id,
    //             'type' => Action::TYPE_NOTIFICATION,
    //             'title' => 'Project report',
    //             'sub_title' => '',
    //             'text' => $message,
    //             'project_id' => $project->id,
    //             'organisation_id' => $project->organisation_id,
    //         ]);
  }
}
