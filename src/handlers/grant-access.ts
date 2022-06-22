import { Context } from "aws-lambda/handler";
import {
  CreateAccountAssignmentCommand,
  DescribeAccountAssignmentCreationStatusCommand,
  SSOAdminClient,
  StatusValues,
} from "@aws-sdk/client-sso-admin";
import * as z from "zod";

const grantAccessEvent = z
  .object({
    accountId: z.string(),
    permissionSetArn: z.string(),
    principalId: z.string(),
    principalUsername: z.string(),
  })
  .passthrough();

export function buildGrantAccessHandler(
  ssoClient: SSOAdminClient,
  instanceArn: string,
) {
  return async function (
    rawEvent: unknown,
    _context: Context,
    _callback: unknown,
  ): Promise<void> {
    const event = grantAccessEvent.parse(rawEvent);

    const result = await ssoClient.send(
      new CreateAccountAssignmentCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: event.permissionSetArn,
        PrincipalType: "USER",
        PrincipalId: event.principalId,
        TargetId: event.accountId,
        TargetType: "AWS_ACCOUNT",
      }),
    );

    if (
      result.AccountAssignmentCreationStatus?.Status === StatusValues.SUCCEEDED
    ) {
      console.log("assigned access with no waiting");
      return;
    }

    let completed = false;

    while (!completed) {
      const currentResult = await ssoClient.send(
        new DescribeAccountAssignmentCreationStatusCommand({
          InstanceArn: instanceArn,
          AccountAssignmentCreationRequestId:
            result.AccountAssignmentCreationStatus?.RequestId,
        }),
      );

      if (
        currentResult.AccountAssignmentCreationStatus?.Status ===
        StatusValues.FAILED
      ) {
        throw new Error(
          `failed to assign access: ${JSON.stringify(
            currentResult.AccountAssignmentCreationStatus,
          )}`,
        );
      }

      if (
        currentResult.AccountAssignmentCreationStatus?.Status ===
        StatusValues.SUCCEEDED
      ) {
        console.log("assigned access with waiting");
        completed = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  };
}
