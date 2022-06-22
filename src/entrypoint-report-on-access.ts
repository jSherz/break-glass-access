import { buildReportOnAccessHandler } from "./handlers/report-on-access";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { SSOAdminClient } from "@aws-sdk/client-sso-admin";
import { SESClient } from "@aws-sdk/client-ses";

if (!process.env.CLOUDTRAIL_LOG_GROUP) {
  throw new Error("You must specify a CLOUDTRAIL_LOG_GROUP.");
}

if (!process.env.INSTANCE_ARN) {
  throw new Error("You must specify a INSTANCE_ARN.");
}

if (!process.env.CONTACT_EMAIL) {
  throw new Error("You must specify a CONTACT_EMAIL.");
}

if (!process.env.FROM_EMAIL) {
  throw new Error("You must specify a FROM_EMAIL.");
}

export const reportOnAccessHandler = buildReportOnAccessHandler(
  new CloudWatchLogsClient({}),
  process.env.CLOUDTRAIL_LOG_GROUP,
  () => new Date(),
  new SSOAdminClient({}),
  process.env.INSTANCE_ARN,
  new SESClient({}),
  process.env.CONTACT_EMAIL,
  process.env.FROM_EMAIL,
);
