import { DataStorage } from "./DataStorage";

/**
 * Used for unit / integration testing.
 */
export class InMemoryDataStorage implements DataStorage {
  private readonly principals: Record<string, string | null> = {};

  private readonly userAccess: Record<string, boolean> = {};

  private static CanAccessKey(
    accountId: string,
    permissionSetArn: string,
    principal: string,
  ) {
    return [accountId, permissionSetArn, principal].join("#");
  }

  resolvePrincipal(principal: string): Promise<string | null> {
    return Promise.resolve(this.principals[principal] || null);
  }

  definePrincipal(principal: string, value: string) {
    this.principals[principal] = value;
  }

  userCanAccess(
    accountId: string,
    permissionSetArn: string,
    principal: string,
  ): Promise<boolean> {
    return Promise.resolve(
      this.userAccess[
        InMemoryDataStorage.CanAccessKey(accountId, permissionSetArn, principal)
      ] || false,
    );
  }

  defineUserAccess(
    accountId: string,
    permissionSetArn: string,
    principal: string,
    value: boolean,
  ) {
    this.userAccess[
      InMemoryDataStorage.CanAccessKey(accountId, permissionSetArn, principal)
    ] = value;
  }
}
