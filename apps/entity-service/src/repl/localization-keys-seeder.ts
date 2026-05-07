import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { LocalizationKey } from "@terramatch-microservices/database/entities";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Dictionary } from "lodash";
import { polygonNotificationMailBody } from "./utils";

const LOG = new TMLogger("Localization Keys Seeder");

const KEYS: Dictionary<string> = {
  // application-submitted.email.ts
  "application-submitted-confirmation.subject": "Your Application Has Been Submitted",
  "application-submitted-confirmation.title": "Your Application Has Been Submitted!",

  // entity-status-update.email.ts
  "entity-status-change.subject-approved": "Your {entityTypeName} Has Been Approved",
  "entity-status-change.subject-needs-more-information":
    "There is More Information Requested About Your {entityTypeName}",
  "entity-status-change.body-report-approved":
    "Thank you for submitting your {parentEntityName} report." +
    "<br><br>The information has been reviewed by your project manager and has been approved. <br><br>{feedback}" +
    "<br><br>If you have any additional questions please reach out to your project manager or to info@terramatch.org<br><br>",
  "entity-status-change.body-report-needs-more-information":
    "Thank you for submitting your {parentEntityName} report." +
    "<br><br>The information has been reviewed by your project manager and they would like to see the following updates: <br><br> {feedback}" +
    "<br><br>If you have any additional questions please reach out to your project manager or to info@terramatch.org<br><br>",
  "entity-status-change.body-entity-approved":
    "Thank you for submitting your {lowerEntityTypeName} information for {entityName}." +
    "<br><br>The information has been reviewed by your project manager and has been approved. <br><br>{feedback}" +
    "<br><br>If you have any additional questions please reach out to your project manager or to info@terramatch.org<br><br>",
  "entity-status-change.body-entity-needs-more-information":
    "Thank you for submitting your {lowerEntityTypeName} information for {entityName}." +
    "<br><br>The information has been reviewed by your project manager and they would like to see the following updates: <br><br> {feedback}" +
    "<br><br>If you have any additional questions please reach out to your project manager or to info@terramatch.org<br><br>",
  "entity-status-change.cta": "View {entityTypeName}",

  // form-submission-feedback.email.ts
  "form-submission-feedback-received.subject": "You have received feedback on your application",
  "form-submission-feedback-received.title": "You have received feedback on your application",
  "form-submission-feedback-received.body": "Your application requires more information.",
  "form-submission-feedback-received.body-feedback":
    "Your application requires more information. Please see comments below:<br><br> {feedback}",
  "form-submission-feedback-received.cta": "View Application",

  // organisation-approved.email.ts
  "organisation-approved.subject": "Your organization has been accepted into TerraMatch.",
  "organisation-approved.title": "YOUR ORGANIZATION HAS BEEN ACCEPTED INTO TERRAMATCH.",
  "organisation-approved.body":
    "Please login to submit an application or report on a monitored project. If you have any questions, please reach out to info@terramatch.org",
  "organisation-approved.cta": "LOGIN",

  // organisation-rejected.email.ts
  "organisation-rejected.subject": "Your organization has been rejected from joining TerraMatch.",
  "organisation-rejected.title": "Your organization has been rejected from joining TerraMatch.",
  "organisation-rejected.body":
    "This could be due to the fact that your organization is already on TerraMatch, \n" +
    "            your organization will not benefit from the services that TerraMatch provides \n" +
    "            or we do not have enough information to understand what your organization does. \n" +
    "            Please login to TerraMatch to view a more detail description about why your \n" +
    "            organization request has been rejected.",

  // organisation-user-approved.email.ts
  "organisation-user-approved.subject": "You have been accepted to join {organisationName} on TerraMatch",
  "organisation-user-approved.title": "You have been accepted to join {organisationName} on TerraMatch",
  "organisation-user-approved.body":
    "You have been accepted to join {organisationName} on TerraMatch. Log-in to view or update your organization’s information.",

  // organisation-join-request.email.ts
  "organisation-user-join-requested.subject": "A user has requested to join your organization",
  "organisation-user-join-requested.title": "A user has requested to join your organization",
  "organisation-user-join-requested.body":
    "A user has requested to join your organization. Please go to the ‘Meet the Team’ page to review this request.",

  // organisation-user-rejected.email.ts
  "organisation-user-rejected.subject": "Your request to join {organisationName} on TerraMatch has been rejected",
  "organisation-user-rejected.title": "Your request to join {organisationName} on TerraMatch has been rejected",
  "organisation-user-rejected.body":
    "Your request to join {organisationName} on TerraMatch has been rejected. <br><br>" +
    "Please set-up a new organizational profile on TerraMatch if you wish to join the platform. " +
    'Please reach out the help center here if you need more information: <a href="https://terramatchsupport.zendesk.com/hc/en-us/requests/new">https://terramatchsupport.zendesk.com/hc/en-us/requests/new</a>',

  // project-invite.email.ts
  "project-invite-received.subject": "Project Invite",
  "project-invite-received.title": "Project Invite",
  "project-invite-received.body":
    "You have been sent an invite to join {name}.<br><br>Click below to accept the invite.<br><br>",
  "project-invite-received.cta": "Accept invite",

  // reset-password.service.ts
  "reset-password.subject": "RESET YOUR PASSWORD",
  "reset-password.title": "RESET YOUR PASSWORD",
  "reset-password.body":
    "You've requested a password reset.<br><br>" +
    "Follow this link to reset your password. It's valid for 2 hours.<br><br>" +
    "If you have any questions, feel free to message us at info@terramatch.org.",
  "reset-password.cta": "Reset Password",

  // send-login-details.email.ts
  "send-login-details.subject": "Welcome to TerraMatch!",
  "send-login-details.title": "Welcome to TerraMatch 🌱 !",
  "send-login-details.body":
    "Hi {userName},<br><br>" +
    "We're thrilled to let you know that your access to TerraMatch is now active!<br><br>" +
    "Your user email used for your account is {mail}<br><br>" +
    "Please click on the button below to set your new password. This link is valid for 7 days from the day you received this email.<br><br>" +
    "If you have any questions or require assistance, our support team is ready to help at info@terramatch.org or +44 7456 289369 (WhatsApp only).<br><br>" +
    "We look forward to working with you!<br><br>" +
    "<br><br>" +
    "Best regards,<br><br>" +
    "TerraMatch Support",
  "send-login-details.cta": "Set Password",

  // bulk-user-creation.email.ts
  "bulk-user-creation.subject": "Welcome to TerraMatch!",
  "bulk-user-creation.title": "Welcome to TerraMatch 🌱 !",
  "bulk-user-creation.body":
    "Hi {userName},<br><br>" +
    "We're thrilled to let you know that your access to TerraMatch is now active and it is time to begin your application to {fundingProgrammeName}!<br><br>" +
    "Your user email used for your account is {mail}<br><br>" +
    "Please click on the button below to set your new password. This link is valid for 7 days from the day you received this email.<br><br>" +
    "If you have any questions or require assistance, our support team is ready to help at info@terramatch.org or +44 7456 289369 (WhatsApp only).<br><br>" +
    "We look forward to working with you!<br><br>" +
    "<br><br>" +
    "Best regards,<br><br>" +
    "TerraMatch Support",
  "bulk-user-creation.cta": "Set Password",

  // polygon-clipping-complete.email.ts
  "polygon-clipping-complete.subject": "Your TerraMatch Polygon Clipping is Complete",
  "polygon-clipping-complete.title": "YOUR POLYGON CLIPPING IS COMPLETE",
  "polygon-clipping-complete.body": "Your polygon clipping for Site {siteName} completed at {time}.",
  "polygon-clipping-complete.cta": "OPEN SITE",

  // terrafund-report-reminder.email.ts
  "terrafund-report-reminder.subject": "It's Time to Report on TerraMatch!",
  "terrafund-report-reminder.title": "YOU HAVE A REPORT DUE!",
  "terrafund-report-reminder.body":
    "Your next report for {projectName} is due on {dueDate} and is ready for you on TerraMatch.<br><br>" +
    "As always, your answers should reflect any progress made in the last six months. If you have any questions, feel free to message us at info@terramatch.org.",
  "terrafund-report-reminder.cta": "View Reporting Task",

  // terrafund-site-and-nursery-reminder.email.ts
  "terrafund-site-and-nursery-reminder.subject": "Terrafund Site & Nursery Reminder",
  "terrafund-site-and-nursery-reminder.title": "Terrafund Site & Nursery Reminder",
  "terrafund-site-and-nursery-reminder.body":
    "You haven't created any sites or nurseries for your project, reports are due in a month.<br><br>" +
    "Click below to create.<br><br>",
  "terrafund-site-and-nursery-reminder.cta": "Create a site or nursery",

  // verification-user.service.ts, user-creation.service.ts
  "user-verification.subject": "Verify Your Email Address",
  "user-verification.title": "VERIFY YOUR EMAIL ADDRESS",
  "user-verification.body":
    "Follow the below link to verify your email address. It's valid for 48 hours.  If the link does not work, log on " +
    "to TerraMatch and resubmit a verfication request. <br>" +
    "If you continue to have problems accessing your account, feel free to message us at info@terramatch.org." +
    "<br><br>-----<br><br>" +
    "Suivez le lien ci-dessous pour vérifier votre adresse e-mail. Ce lien est valable pendant 48 heures.  Si le lien ne fonctionne pas, " +
    "connectez-vous à TerraMatch et soumettez à nouveau une demande de vérification.<br>" +
    "Si vous continuez à avoir des problèmes pour accéder à votre compte, n'hésitez pas à nous envoyer un message à l'adresse info@terramatch.org.",
  "user-verification.cta": "VERIFY EMAIL ADDRESS",

  // project-invite.email.ts
  "v2-project-invite-received.subject": "You have been invited to join TerraMatch",
  "v2-project-invite-received.title": "You have been invited to join TerraMatch",
  "v2-project-invite-received.body": `{organisationName} has invited you to join TerraMatch as a monitoring
            partner to {name}. Set an account password today to see the project’s
            progress and access their latest reports.<br><br>
            Reset your password <a href="{callbackUrl}" style="color: #6E6E6E;">Here.</a><br><br>`,

  // project-monitoring-notification.email.ts
  "v2-project-monitoring-notification.subject": "You have been added as a monitoring partner.",
  "v2-project-monitoring-notification.title": "You have been added as a monitoring partner.",
  "v2-project-monitoring-notification.body":
    "You have been added to {name} as a monitoring partner on TerraMatch. Login into your account today to see the project progress and relevant reports.<br><br>",
  "v2-project-monitoring-notification.cta": "Login",

  // admin-report-reminder.email.ts
  "report-reminder.subject": "Reminder: Your {entityTypeName} Still Needs Your Input",
  "report-reminder.title": "Reminder: Your {entityTypeName} Still Needs Your Input",
  "report-reminder.body":
    "This is a reminder that your {entityTypeName} for {entityModelName} still has the status: {entityStatus}. Below you will see a note from your project manager about the report.<br><br> \n" +
    '            Here is a link to the reporting task on TerraMatch so you can easily access your report: <a href="{callbackUrl}" style="color: #6E6E6E;">Here.</a> If you have any questions, please reach out to your project manager or to info@terramatch.org.<br><br>{feedback}',

  // financial-report-reminder.email.ts
  "financial-report-reminder.subject": "TerraFund Report Reminder",
  "financial-report-reminder.title": "Reminder: Your Financial Report Still Needs Your Input",
  "financial-report-reminder.body":
    "This is a reminder that your financial report for {entityModelName} is due on {dueAt}.<br><br> \n" +
    '            <a href="{callbackUrl}" style="color: #6E6E6E;">Here is a link to your "My Organization" page on TerraMatch</a>, where you can find your report.<br><br> \n' +
    '            You can find detailed guidance for this report here: <a href="https://terramatchsupport.zendesk.com/hc/en-us/articles/40711356869019-Financial-Reporting-for-Restoration-Enterprises" style="color: #6E6E6E;">Financial Reporting for Restoration Enterprises</a>.<br><br>\n' +
    "            If you have any questions, please reach out to your project manager or to info@terramatch.org.<br><br>",
  "financial-report-reminder.cta": "View Report",

  // task-digest.email.ts
  "task-digest.subject": "{projectName} - Report Summary for {date}",
  "task-digest.title": "Action Items Summary - Task Due {date}",
  "task-digest.body": `Please note: this digest summarizes any reports that require engagement or were approved in the past week. Any reports already approved will not be mentioned below, since they do not require any action. Once all reports in this task are approved, the task status will be changed to approved, and you’ll no longer receive this digest.
            <table class="full-width-fixed-table">
            <tr class="border-light-gray">
                <th class="border-light-gray" style="width: 25%;">Submission State</th>
                <th class="border-light-gray" style="width: 25%;">Report Name</th>
                <th class="border-light-gray" style="width: 25%;">Status</th>
                <th class="border-light-gray" style="width: 25%;">Change Request</th>
                <th class="border-light-gray" style="width: 25%;">Latest comments</th>
            </tr>
            {reportData}
            </table>`,
  "task-digest.cta": "Access this task here",

  // project-invite.email.ts
  "v2-project-invite-received-create.subject": "YOU HAVE BEEN INVITED TO JOIN TERRAMATCH",
  "v2-project-invite-received-create.title": "YOU HAVE BEEN INVITED TO JOIN TERRAMATCH",
  "v2-project-invite-received-create.body": `{organisationName} has invited you to join TerraMatch as a monitoring partner on {projectName}
            Click the link below to create your account and set your password so you can see the project’s progress and access its reports.`,
  "v2-project-invite-received-create.cta": "CREATE ACCOUNT",

  // weekly-polygon-update.email.ts
  "terrafund-polygon-update.subject": "Weekly Update on Polygon Changes",
  "terrafund-polygon-update.title": "Polygon Updates Week of {date}",
  "terrafund-polygon-update.cta": "View Updates",
  "terrafund-polygon-update.manager.body": polygonNotificationMailBody(true),
  "terrafund-polygon-update.pd.body": polygonNotificationMailBody(false),

  // organisation-invite.email.ts
  "v2-organisation-invite-received-create.subject": "YOU HAVE BEEN INVITED TO JOIN TERRAMATCH",
  "v2-organisation-invite-received-create.title": "YOU HAVE BEEN INVITED TO JOIN TERRAMATCH",
  "v2-organisation-invite-received-create.body": `{organisationName} has invited you to join TerraMatch as a team member.
            Click the link below to create your account and set your password so you can see the ongoing applications for this organization.`,
  "v2-organisation-invite-received-create.cta": "CREATE ACCOUNT"
};

export const seedLocalizationKeys = withoutSqlLogs(async () => {
  for (const [key, value] of Object.entries(KEYS)) {
    await ensureKey(key, value);
  }
});

const ensureKey = async (key: string, value: string) => {
  const existing = await LocalizationKey.findOne({ where: { key } });
  if (existing?.value === value) return;

  const valueId = await getService(LocalizationService).generateI18nId(value);
  if (valueId == null) {
    LOG.error(`Failed to generate i18n id for value: ${value}`);
    return;
  }

  if (existing != null) {
    await existing.update({ value, valueId });
    LOG.log(`Updated existing key: ${key}`);
  } else {
    await LocalizationKey.create({ key, value, valueId });
    LOG.log(`Created new key: ${key}`);
  }
};
