import { Context } from "aws-lambda/handler";
import * as z from "zod";
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  QueryStatus,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const reportOnAccessEvent = z
  .object({
    startTime: z.string(),
    accountId: z.string(),
    role: z.string(),
    principal: z.string(),
  })
  .passthrough();

type ReportOnAccessEvent = z.infer<typeof reportOnAccessEvent>;

export function buildReportOnAccessHandler(
  logsClient: CloudWatchLogsClient,
  logGroupName: string,
  getTime: () => Date,
) {
  return async function (
    rawEvent: unknown,
    context: Context,
    callback: unknown,
  ): Promise<void> {
    const event = reportOnAccessEvent.parse(rawEvent);

    // TODO: the real query

    const query = await logsClient.send(
      new StartQueryCommand({
        logGroupName,
        queryString:
          "fields @timestamp, @message\n" +
          "| sort @timestamp desc\n" +
          "| limit 20",
        startTime: Math.floor(new Date(event.startTime).getTime() / 1000),
        endTime: Math.ceil(getTime().getTime() / 1000),
      }),
    );

    let complete = false;

    while (!complete) {
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
        complete = true;
        console.log(JSON.stringify(results.results));
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

    console.log("reported on access");
  };
}
