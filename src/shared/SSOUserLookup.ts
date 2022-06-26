import {
  DescribeUserCommand,
  IdentitystoreClient,
} from "@aws-sdk/client-identitystore";

export interface ISSOUserLookup {
  userIdToUserName(id: string): Promise<string>;
}

export class SSOUserLookup implements ISSOUserLookup {
  constructor(
    private readonly idClient: IdentitystoreClient,
    private readonly identityStoreId: string,
  ) {}

  async userIdToUserName(id: string): Promise<string> {
    const user = await this.idClient.send(
      new DescribeUserCommand({
        IdentityStoreId: this.identityStoreId,
        UserId: id,
      }),
    );

    // User must have a username
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return user.UserName!;
  }
}
