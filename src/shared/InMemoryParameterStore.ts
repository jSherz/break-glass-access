import { IParameterStore } from "./CachedSSM";

/**
 * Used for unit / integration testing.
 */
export class InMemoryParameterStore implements IParameterStore {
  private readonly parameters: Record<string, string> = {};

  setParameter(name: string, value: string) {
    this.parameters[name] = value;
  }

  getParameter(name: string): Promise<string> {
    return Promise.resolve(this.parameters[name]);
  }
}
