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
  syncConfigs,
  discoverServers,
  createManager,
} from 'mcp-config-ts';

// Load a config file
const config = await loadConfig('.mcp.json');

// Validate the config
const result = await validateConfig(config, { level: 3 });
console.log(result.valid); // true or false
console.log(result.completenessScore); // 0-100

// Add a server
const updated = addServer(config, 'my-server', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
});

// Save the config
await saveConfig(updated);

// Remove a server
const withoutServer = removeServer(updated, 'my-server');

// Discover available servers from the registry
const servers = await discoverServers({ searchNpm: true, limit: 10 });

// Use the ConfigManager for stateful operations
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
