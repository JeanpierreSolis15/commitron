import type { Environment } from "../app/ports";

export function nodeEnvironment(): Environment {
  return { platform: process.platform, variables: process.env };
}
