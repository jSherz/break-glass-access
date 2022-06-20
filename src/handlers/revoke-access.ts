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
    role: z.string(),
    principal: z.string(),
  })
  .passthrough();

type RevokeAccessEvent = z.infer<typeof revokeAccessEvent>;

export function buildRevokeAccessHandler(
  ssoClient: SSOAdminClient,
  instanceArn: string,
) {
  return async function (
    rawEvent: unknown,
    context: Context,
    callback: unknown,
  ): Promise<void> {
    const event = revokeAccessEvent.parse(rawEvent);

    const result = await ssoClient.send(
      new DeleteAccountAssignmentCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: event.role,
        PrincipalType: "USER",
        PrincipalId: event.principal,
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
