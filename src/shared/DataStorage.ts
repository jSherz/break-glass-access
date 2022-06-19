import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

export abstract class DataStorage {
  /**
   * Can a user identified by principal access the given account ID and role?
   *
   * @param accountId AWS account ID
   * @param role SSO permission set name
   * @param principal User's ID or ARN
   */
  abstract userCanAccess(
    accountId: string,
    role: string,
    principal: string,
  ): Promise<boolean>;

  /**
   * Resolves a messaging service principal (e.g. Slack ID) into an SSO principal.
   *
   * @param principal e.g. Slack ID
   */
  abstract resolvePrincipal(principal: string): Promise<string | null>;
}

export class DDBDataStorage extends DataStorage {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    super();
  }

  async userCanAccess(
    accountId: string,
    role: string,
    principal: string,
  ): Promise<boolean> {
    const item = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          id: {
            S: `access#${accountId}#${role}#${principal}`,
          },
        },
      }),
    );

    return item.Item !== null;
  }

  async resolvePrincipal(principal: string): Promise<string | null> {
    const item = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          id: {
            S: `principal#${principal}`,
          },
        },
      }),
    );

    return item.Item?.ssoPrincipal.S || null;
  }
}
