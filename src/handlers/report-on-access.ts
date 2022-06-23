import { Context } from "aws-lambda/handler";
import * as z from "zod";
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  QueryStatus,
  ResultField,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  DescribePermissionSetCommand,
  SSOAdminClient,
} from "@aws-sdk/client-sso-admin";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import handlebars from "handlebars";
import { promises as fs } from "fs";
import * as path from "path";
import { breakGlassEvent } from "../shared/events";

const reportOnAccessEvent = breakGlassEvent.merge(
  z
    .object({
      startTime: z.string(),
    })
    .passthrough(),
);

function formatCloudTrailResults(
  results: ResultField[][],
): Array<Record<string, unknown>> {
  return results.reduce((out, row) => {
    out.push(
      row.reduce((rowOut, column) => {
        // All columns are titled in this query
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        rowOut[column.field!] = column.value;

        return rowOut;
      }, {} as Record<string, unknown>),
    );

    return out;
  }, [] as Array<Record<string, unknown>>);
}

async function searchCloudTrail(
  logsClient: CloudWatchLogsClient,
  logGroupName: string,
  queryString: string,
  startTime: Date,
  endTime: Date,
): Promise<Array<Record<string, unknown>>> {
  const query = await logsClient.send(
    new StartQueryCommand({
      logGroupName,
      queryString,
      startTime: Math.floor(startTime.getTime() / 1000),
      endTime: Math.ceil(endTime.getTime() / 1000),
    }),
  );

  // ensures this is typed correctly, we either return or throw
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const results = await logsClient.send(
      new GetQueryResultsCommand({
        queryId: query.queryId,
      }),
    );

    if (
      results.status === QueryStatus.Failed ||
      results.status === QueryStatus.Timeout ||
      results.status === QueryStatus.Cancelled
    ) {
      throw new Error(`logs query failed: ${JSON.stringify(results)}`);
    }

    if (results.status === QueryStatus.Complete) {
      return formatCloudTrailResults(results.results || []);
    }

    // Sleep for 15 seconds if we're waiting for results
    if (
      results.status === QueryStatus.Running ||
      results.status === QueryStatus.Scheduled ||
      results.status === QueryStatus.Unknown
    ) {
      console.log(`sleeping while we wait for query: ${results.status}`);
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }
}

export function buildReportOnAccessHandler(
  logsClient: CloudWatchLogsClient,
  logGroupName: string,
  getTime: () => Date,
  ssoClient: SSOAdminClient,
  instanceArn: string,
  sesClient: SESClient,
  contactEmail: string,
  fromEmail: string,
) {
  return async function (
    rawEvent: unknown,
    _context: Context,
    _callback: unknown,
  ): Promise<void> {
    const event = reportOnAccessEvent.parse(rawEvent);

    const startTime = new Date(event.startTime);
    const endTime = getTime();

    const ssoUserActivity = await searchCloudTrail(
      logsClient,
      logGroupName,
      `filter userIdentity.principalId == "${event.principalId}"\n` +
        "| stats count(*) as num_events by eventSource, eventName, readOnly\n" +
        "| sort by readOnly asc, num_events desc",
      startTime,
      endTime,
    );

    const permissionSet = await ssoClient.send(
      new DescribePermissionSetCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: event.permissionSetArn,
      }),
    );

    const assumedRoleActivity = await searchCloudTrail(
      logsClient,
      logGroupName,
      `filter userIdentity.arn like /arn:aws:sts::${event.accountId}:assumed-role\\/AWSReservedSSO_${permissionSet.PermissionSet?.Name}_.*\\/${event.principalUsername}/\n` +
        "| stats count(*) as num_events by eventSource, eventName, readOnly\n" +
        "| sort by readOnly asc, num_events desc",
      startTime,
      endTime,
    );

    const textTemplate = handlebars.compile(
      await fs.readFile(
        path.join(process.cwd(), "src", "templates", "report.txt.hbs"),
        "utf-8",
      ),
    );

    const htmlTemplate = handlebars.compile(
      await fs.readFile(
        path.join(process.cwd(), "src", "templates", "report.html.hbs"),
        "utf-8",
      ),
    );

    const templateArgs = {
      username: event.principalUsername,
      accountId: event.accountId,
      ssoUserActivity,
      assumedRoleActivity,
      startTime,
      endTime,
    };

    await sesClient.send(
      new SendEmailCommand({
        Destination: {
          ToAddresses: [contactEmail],
        },
        Message: {
          Body: {
            Html: {
              Charset: "utf-8",
              Data: htmlTemplate(templateArgs),
            },
            Text: {
              Charset: "utf-8",
              Data: textTemplate(templateArgs),
            },
          },
          Subject: {
            Charset: "utf-8",
            Data: `Break glass access report for ${event.principalUsername}`,
          },
        },
        Source: fromEmail,
      }),
    );

    console.log("reported on access");
  };
}
