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
