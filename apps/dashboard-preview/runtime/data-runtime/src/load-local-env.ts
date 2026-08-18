import { config } from "dotenv";
import { fileURLToPath } from "node:url";

export const DEFAULT_LOCAL_ENV_PATH = fileURLToPath(new URL("../.env.local", import.meta.url));

export function loadLocalEnv(path = DEFAULT_LOCAL_ENV_PATH): void {
	config({ path, quiet: true, override: false });
}

loadLocalEnv();