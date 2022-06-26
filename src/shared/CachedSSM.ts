import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export interface IParameterStore {
  getParameter(name: string): Promise<string>;
}

/**
 * Used to lookup secrets from SSM and cache them between Lambda invocations
 * where we get to keep the container.
 */
export class CachedSSM implements IParameterStore {
  private cache: Record<string, string> = {};

  constructor(private readonly ssm: SSMClient = new SSMClient({})) {}

  async getParameter(name: string): Promise<string> {
    if (this.cache[name]) {
      return this.cache[name];
    }

    const result = await this.ssm.send(
      new GetParameterCommand({
        Name: name,
        WithDecryption: true,
      }),
    );

    if (result.Parameter?.Value) {
      this.cache[name] = result.Parameter?.Value;
    }

    return this.cache[name];
  }
}
