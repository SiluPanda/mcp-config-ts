# mcp-config-ts

CLI to discover, add, validate, and sync MCP server configs.

## Installation

```bash
npm install mcp-config-ts
```

Or run directly with npx:

```bash
npx mcp-config-ts validate
```

## Quick Start

```typescript
import {
  loadConfig,
  saveConfig,
  validateConfig,
  addServer,
  removeServer,
  getServer,
  listServers,
  createManager,
} from 'mcp-config-ts';

// Load a config file (synchronous)
const config = loadConfig('.mcp.json');

// Validate the config
const result = await validateConfig(config, { level: 3 });
console.log(result.valid); // true or false
console.log(result.completenessScore); // 0-100

// Add a server (mutates config in place)
addServer(config, 'my-server', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
});

// Save the config (synchronous, creates parent dirs automatically)
saveConfig(config);

// Remove a server (mutates config in place)
removeServer(config, 'my-server');

// List all server names (sorted)
const names = listServers(config); // ['github', 'filesystem', ...]

// Get a single server entry
const entry = getServer(config, 'github'); // ServerEntry | undefined

// Use the ConfigManager for stateful load/save/validate operations
const manager = createManager({ configPath: '.mcp.json' });
await manager.load();
manager.add('github', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
});
await manager.save();
```

## API Reference

### `loadConfig(configPath?: string): MCPConfig`

Loads and parses an MCP config file synchronously.

- `configPath` defaults to `.mcp.json` in the current working directory.
- Throws `ConfigNotFoundError` if the file does not exist.
- Throws `ConfigParseError` if the file is not valid JSON.
- Infers `type: 'stdio'` for entries with a `command` field, `type: 'http'` for entries with a `url` field.
- Non-`mcpServers` keys are preserved in `config._otherKeys` for round-trip writing.

### `saveConfig(config: MCPConfig): void`

Writes an `MCPConfig` object to disk synchronously.

- Creates parent directories automatically (`mkdirSync` with `recursive: true`).
- Strips the `type` field from each server entry (not stored on disk).
- Merges `_otherKeys` back into the output so non-MCP fields are preserved.
- Writes JSON with 2-space indentation and a trailing newline.

### `validateConfig(config: MCPConfig, options?: { level?: 1 | 2 | 3 }): Promise<ValidationResult>`

Validates an `MCPConfig` object and returns a `ValidationResult`.

- `level 1`: JSON syntax check only.
- `level 2`: JSON syntax + schema checks (mcpServers present, entries valid).
- `level 3` (default): all checks including URL format and non-empty command warnings.
- `completenessScore`: 0–100, reduced by 30 per error failure and 10 per warning failure.
- `valid`: `true` only when no error-severity checks fail.

### `createManager(options?: ManagerOptions): ConfigManager`

Creates a stateful config manager.

- `options.configPath`: path to the config file (defaults to `.mcp.json`).
- Call `manager.load()` before any other methods.
- Mutations (`add`, `remove`) are in-memory until `manager.save()` is called.

#### `ConfigManager` methods

| Method | Description |
|---|---|
| `load(): Promise<void>` | Load config from disk |
| `save(): Promise<void>` | Persist current config to disk |
| `getConfig(): MCPConfig` | Return the loaded config object |
| `list(): string[]` | Return sorted array of server names |
| `get(name): ServerEntry \| undefined` | Return a server entry by name |
| `has(name): boolean` | Check if a server exists |
| `add(name, entry): void` | Add a server (throws `ServerExistsError` if exists) |
| `remove(name): void` | Remove a server (throws `ServerNotFoundError` if missing) |
| `validate(opts?): Promise<ValidationResult>` | Validate the current config |

### `addServer(config, name, entry): void`

Adds a server entry to the config in place. Throws `ServerExistsError` if a server with that name already exists.

### `removeServer(config, name): void`

Removes a server entry from the config in place. Throws `ServerNotFoundError` if the server does not exist.

### `getServer(config, name): ServerEntry | undefined`

Returns the server entry for the given name, or `undefined` if not found.

### `listServers(config): string[]`

Returns a sorted array of all server names in the config.

## Available Exports

### Types

- `MCPConfig` -- Parsed MCP configuration object
- `StdioServerEntry` -- A stdio transport server entry
- `HttpServerEntry` -- An HTTP transport server entry
- `ServerEntry` -- Union of StdioServerEntry | HttpServerEntry
- `ValidationCheck` -- Individual validation check result
- `ValidationResult` -- Full validation result with summary and completeness score
- `SyncOptions` -- Options for syncing configs between files
- `SyncResult` -- Result of a sync operation
- `ServerInfo` -- Discoverable MCP server info
- `DiscoverOptions` -- Options for server discovery
- `ManagerOptions` -- Options for creating a ConfigManager
- `ConfigManager` -- Stateful config manager interface
- `RegistryEntry` -- Built-in server registry entry

### Error Classes

- `MCPConfigError` -- Base error class (code: string)
- `ConfigNotFoundError` -- Config file not found (code: `CONFIG_NOT_FOUND`)
- `ConfigParseError` -- Config file is not valid JSON (code: `CONFIG_PARSE_ERROR`)
- `ServerExistsError` -- Server already exists in config (code: `SERVER_EXISTS`)
- `ServerNotFoundError` -- Server not found in config or registry (code: `SERVER_NOT_FOUND`)
- `ValidationError` -- Validation failed at a critical level (code: `VALIDATION_ERROR`)

## CLI Commands

```
mcp-config validate [--config <path>] [--level <1-5>] [--format json]
    Validate the MCP config file. Exits with code 1 if validation fails.

mcp-config add <name> [--command <cmd>] [--args <args...>] [--url <url>] [--env KEY=VAL]
    Add a server to the config. Supports registry lookup by name.

mcp-config list [--all] [--format json]
    List servers in the config. Use --all to scan all known config locations.

mcp-config sync <source> <target> [--strategy skip|overwrite|merge-env] [--dry-run]
    Sync servers from one config to another.

mcp-config search <query> [--npm] [--limit <n>]
    Search for MCP servers in the built-in registry and npm.

mcp-config doctor [--check-npm] [--check-env] [--format json]
    Run comprehensive diagnostics on the config.

mcp-config init [--with <servers...>] [--force]
    Create a new .mcp.json config file.
```

Global options: `--config <path>`, `--format human|json`, `--quiet`, `--version`, `--help`.

## License

MIT
