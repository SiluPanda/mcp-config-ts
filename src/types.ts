// ── Config Types ─────────────────────────────────────────────────────

/** A stdio server entry. */
export interface StdioServerEntry {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

/** An HTTP server entry. */
export interface HttpServerEntry {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/** A server entry (stdio or HTTP). */
export type ServerEntry = StdioServerEntry | HttpServerEntry;

/** A parsed MCP configuration. */
export interface MCPConfig {
  /** The servers declared in this config. */
  servers: Record<string, ServerEntry>;

  /** The file path this config was loaded from. */
  filePath: string;

  /** Non-MCP keys in the original file, preserved for round-trip writing. */
  _otherKeys?: Record<string, unknown>;
}

// ── Validation Types ─────────────────────────────────────────────────

/** An individual validation check result. */
export interface ValidationCheck {
  /** Check identifier (e.g., 'json-syntax', 'schema-mcpservers-present', 'command-exists:npx'). */
  id: string;

  /** Severity: 'error' for hard failures, 'warning' for potential issues. */
  severity: 'error' | 'warning';

  /** Whether this check passed. */
  passed: boolean;

  /** Human-readable description of what was checked. */
  message: string;

  /** The server name this check applies to, if server-specific. */
  serverName?: string;

  /** Suggestion for fixing the issue, if applicable. */
  suggestion?: string;
}

/** Result of config validation. */
export interface ValidationResult {
  /** Whether the config passed all checks. */
  valid: boolean;

  /** Path to the validated config file. */
  configPath: string;

  /** Individual check results. */
  checks: ValidationCheck[];

  /** Summary counts. */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };

  /** Completeness score (0-100). */
  completenessScore: number;
}

// ── Sync Types ───────────────────────────────────────────────────────

export interface SyncOptions {
  /** Path to the source config file, or a tool alias ('claude-desktop', 'cursor', 'windsurf', 'cline'). */
  source: string;

  /** Path to the target config file, or a tool alias. */
  target: string;

  /** Which servers to sync. If omitted, all servers from the source are synced. */
  servers?: string[];

  /** How to handle conflicts when the target already has a server with the same name. */
  conflictStrategy: 'skip' | 'overwrite' | 'merge-env';

  /** If true, perform a dry run: report what would change without modifying the target. */
  dryRun: boolean;
}

export interface SyncResult {
  /** Path to the source config file. */
  sourcePath: string;

  /** Path to the target config file. */
  targetPath: string;

  /** Servers that were added to the target (new). */
  added: string[];

  /** Servers that were updated in the target (overwrite or merge-env). */
  updated: string[];

  /** Servers that were skipped (already exist in target, strategy is 'skip'). */
  skipped: string[];

  /** Servers in the source that were not synced due to errors. */
  errors: Array<{ serverName: string; error: string }>;

  /** Whether any changes were made (false for dry runs or when everything is skipped). */
  changed: boolean;
}

// ── Discovery Types ──────────────────────────────────────────────────

/** Information about a discoverable MCP server. */
export interface ServerInfo {
  name: string;
  description: string;
  npmPackage: string;
  category: string;
  requiredEnvVars: Array<{ name: string; description: string; sensitive: boolean }>;
  source: 'registry' | 'npm';
  weeklyDownloads?: number;
  homepage?: string;
}

export interface DiscoverOptions {
  /** Whether to also search the npm registry. */
  searchNpm?: boolean;

  /** Maximum number of results to return. */
  limit?: number;
}

// ── Manager Types ────────────────────────────────────────────────────

export interface ManagerOptions {
  /** Default config file path. Defaults to `.mcp.json` in cwd. */
  configPath?: string;

  /** Validation level for automatic validation. */
  validationLevel?: 1 | 2 | 3;
}

export interface ConfigManager {
  /** Load the config from disk. */
  load(): Promise<void>;

  /** Save the current config to disk. */
  save(): Promise<void>;

  /** Get the current config. Throws if not loaded. */
  getConfig(): MCPConfig;

  /** List all server names. */
  list(): string[];

  /** Get a specific server entry. */
  get(serverName: string): ServerEntry | undefined;

  /** Add a server. Throws if it already exists. */
  add(serverName: string, entry: ServerEntry): void;

  /** Add a server from the built-in registry. */
  addFromRegistry(registryName: string, envValues?: Record<string, string>): void;

  /** Remove a server. Throws if it does not exist. */
  remove(serverName: string): void;

  /** Validate the current config. */
  validate(options?: { level?: 1 | 2 | 3 }): Promise<ValidationResult>;

  /** Check if a server exists. */
  has(serverName: string): boolean;
}

// ── Registry Types ────────────────────────────────────────────────────

export interface RegistryEntry {
  name: string;
  description: string;
  npmPackage: string;
  category: string;
  entry: ServerEntry;
  requiredEnvVars?: Array<{
    name: string;
    description: string;
    example: string;
    sensitive: boolean;
  }>;
  optionalEnvVars?: Array<{
    name: string;
    description: string;
    example: string;
    default?: string;
    sensitive: boolean;
  }>;
  keywords: string[];
  homepage?: string;
}
