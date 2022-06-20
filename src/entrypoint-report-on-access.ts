import { buildReportOnAccessHandler } from "./handlers/report-on-access";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";

if (!process.env.CLOUDTRAIL_LOG_GROUP) {
  throw new Error("You must specify a CLOUDTRAIL_LOG_GROUP.");
}

export const reportOnAccessHandler = buildReportOnAccessHandler(
  new CloudWatchLogsClient({}),
  process.env.CLOUDTRAIL_LOG_GROUP,
  () => new Date(),
);
