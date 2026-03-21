// mcp-config-ts - CLI to discover, add, validate, and sync MCP server configs
export type {
  StdioServerEntry,
  HttpServerEntry,
  ServerEntry,
  MCPConfig,
  ValidationCheck,
  ValidationResult,
  SyncOptions,
  SyncResult,
  ServerInfo,
  DiscoverOptions,
  ManagerOptions,
  ConfigManager,
  RegistryEntry,
} from './types';
export {
  MCPConfigError,
  ConfigNotFoundError,
  ConfigParseError,
  ServerExistsError,
  ServerNotFoundError,
  ValidationError,
} from './utils/errors';
export { loadConfig } from './config/load';
export { saveConfig } from './config/save';
export { addServer, removeServer, getServer, listServers } from './config/operations';
export { createManager } from './config/manager';
export { validateConfig } from './validation/validate';
export { validateJsonSyntax } from './validation/json-syntax';
export { validateSchema } from './validation/schema';
