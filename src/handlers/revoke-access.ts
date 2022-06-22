import { Context } from "aws-lambda/handler";
import {
  DeleteAccountAssignmentCommand,
  DescribeAccountAssignmentDeletionStatusCommand,
  SSOAdminClient,
  StatusValues,
} from "@aws-sdk/client-sso-admin";
import * as z from "zod";

const revokeAccessEvent = z
  .object({
    accountId: z.string(),
    permissionSetArn: z.string(),
    principalId: z.string(),
    principalUsername: z.string(),
  })
  .passthrough();

export function buildRevokeAccessHandler(
  ssoClient: SSOAdminClient,
  instanceArn: string,
) {
  return async function (
    rawEvent: unknown,
    _context: Context,
    _callback: unknown,
  ): Promise<void> {
    const event = revokeAccessEvent.parse(rawEvent);

    const result = await ssoClient.send(
      new DeleteAccountAssignmentCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: event.permissionSetArn,
        PrincipalType: "USER",
        PrincipalId: event.principalId,
        TargetId: event.accountId,
        TargetType: "AWS_ACCOUNT",
      }),
    );

    if (
      result.AccountAssignmentDeletionStatus?.Status === StatusValues.SUCCEEDED
    ) {
      console.log("revoked access with no waiting");
      return;
    }

    let completed = false;

    while (!completed) {
      const currentResult = await ssoClient.send(
        new DescribeAccountAssignmentDeletionStatusCommand({
          InstanceArn: instanceArn,
          AccountAssignmentDeletionRequestId:
            result.AccountAssignmentDeletionStatus?.RequestId,
        }),
      );

      if (
        currentResult.AccountAssignmentDeletionStatus?.Status ===
        StatusValues.FAILED
      ) {
        throw new Error(
          `failed to revoke access: ${JSON.stringify(
            currentResult.AccountAssignmentDeletionStatus,
          )}`,
        );
      }

      if (
        currentResult.AccountAssignmentDeletionStatus?.Status ===
        StatusValues.SUCCEEDED
      ) {
        console.log("revoked access with waiting");
        completed = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  };
}
