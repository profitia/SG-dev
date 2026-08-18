import type { ConnectorFactory, ConnectorStageInput, RuntimeConnector } from "./connector-contracts.ts";
import { SnowflakeConnector } from "./snowflake-connector.ts";

export class DefaultConnectorFactory implements ConnectorFactory {
  create(input: ConnectorStageInput): RuntimeConnector {
    switch (input.connector.kind) {
      case "snowflake":
        return new SnowflakeConnector(input);
      default:
        throw new Error(`Unsupported connector kind: ${input.connector.kind satisfies never}`);
    }
  }
}