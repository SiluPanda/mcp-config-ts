# mcp-config-ts

Typed library and CLI for discovering, adding, validating, and syncing MCP server configurations.

[![npm version](https://img.shields.io/npm/v/mcp-config-ts.svg)](https://www.npmjs.com/package/mcp-config-ts)
[![npm downloads](https://img.shields.io/npm/dt/mcp-config-ts.svg)](https://www.npmjs.com/package/mcp-config-ts)
[![license](https://img.shields.io/npm/l/mcp-config-ts.svg)](https://github.com/SiluPanda/mcp-config-ts/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/mcp-config-ts.svg)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/mcp-config-ts.svg)](https://www.npmjs.com/package/mcp-config-ts)

---

## Description

`mcp-config-ts` manages the `.mcp.json` configuration files that MCP-compatible tools (Claude Code, Claude Desktop, Cursor, Windsurf, Cline) use to connect to MCP servers. It provides both a programmatic TypeScript API and a CLI (`mcp-config`) for the full configuration lifecycle: loading and parsing config files, adding and removing server entries, validating configs at multiple levels of strictness, and syncing servers across projects.

The library handles two MCP transport types -- **stdio** (subprocess spawned via a command like `npx` or `node`) and **HTTP** (remote server at a URL) -- and automatically infers the transport type when loading configs from disk. Non-MCP keys in config files are preserved across load/save round-trips, so tool-specific settings (such as Claude Desktop preferences) are never lost.

## Installation

```bash
npm install mcp-config-ts
```

Or run the CLI directly with npx:

```bash
npx mcp-config-ts validate
```

**Requirements:** Node.js >= 18

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
console.log(result.valid);            // true or false
console.log(result.completenessScore); // 0-100

// Add a server (mutates config in place)
addServer(config, 'my-server', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
});

// Save the config (synchronous, creates parent dirs automatically)
saveConfig(config);

// Remove a server
removeServer(config, 'my-server');

// List all server names (sorted alphabetically)
const names = listServers(config); // ['filesystem', 'github', ...]

// Get a single server entry
const entry = getServer(config, 'github'); // ServerEntry | undefined
```

### Firewall-wrapped stdio entry

You can also register a stdio server through a wrapper command when you want a transport boundary in front of an existing MCP server:

```typescript
addServer(config, 'filesystem-safe', {
  type: 'stdio',
  command: 'npx',
  args: [
    '-y',
    'mcp-transport-firewall',
    '--',
    'npx',
    '-y',
    '@modelcontextprotocol/server-filesystem',
    '/path/to/dir',
  ],
});
```

See the package config examples in [`mcp-transport-firewall`](https://github.com/shleder/mcp-transport-firewall/blob/main/docs/CLIENT_CONFIGS.md) for more wrapper patterns.

## Features

- **Load and parse** `.mcp.json` files with automatic transport type inference (stdio vs. HTTP).
- **Round-trip safe** -- non-MCP keys in config files are preserved across load and save operations.
- **Multi-level validation** -- check JSON syntax (level 1), schema structure (level 2), and transport consistency including URL format and command checks (level 3).
- **Completeness scoring** -- a 0-100 score reflecting config quality, reduced by errors (-30) and warnings (-10).
- **Server CRUD** -- add, remove, get, list, and check existence of server entries with typed error handling.
- **Stateful manager** -- `createManager()` provides a high-level interface that encapsulates load/save/validate/mutate operations.
- **Typed errors** -- all error conditions throw specific error subclasses with machine-readable `code` properties for programmatic handling.
- **Zero runtime dependencies** -- only Node.js built-in modules (`fs`, `path`, `os`, `crypto`).

## API Reference

### `loadConfig(configPath?: string): MCPConfig`

Loads and parses an MCP config file synchronously.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `configPath` | `string` | `'.mcp.json'` (resolved from cwd) | Path to the config file |

**Returns:** `MCPConfig` -- the parsed configuration object.

**Behavior:**

- Reads the file synchronously and parses it as JSON.
- Infers `type: 'stdio'` for entries with a `command` field, `type: 'http'` for entries with a `url` field.
- Non-`mcpServers` keys are preserved in `config._otherKeys` for round-trip writing.
- If `mcpServers` is missing, returns an empty `servers` object (does not throw).

**Throws:**

- `ConfigNotFoundError` -- file does not exist or is unreadable.
- `ConfigParseError` -- file content is not valid JSON.

```typescript
const config = loadConfig('/path/to/project/.mcp.json');
console.log(config.filePath);  // absolute path
console.log(config.servers);   // Record<string, ServerEntry>
```

---

### `saveConfig(config: MCPConfig): void`

Writes an `MCPConfig` object to disk synchronously.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | `MCPConfig` | The config object to write (uses `config.filePath` as destination) |

**Behavior:**

- Creates parent directories automatically (`mkdirSync` with `recursive: true`).
- Strips the `type` field from each server entry (transport type is inferred, not stored on disk).
- Merges `_otherKeys` back into the output so non-MCP fields are preserved.
- Writes JSON with 2-space indentation and a trailing newline.

```typescript
addServer(config, 'new-server', { type: 'stdio', command: 'node', args: ['server.js'] });
saveConfig(config); // writes to config.filePath
```

---

### `validateConfig(config: MCPConfig, options?: { level?: 1 | 2 | 3 }): Promise<ValidationResult>`

Validates an `MCPConfig` object and returns a `ValidationResult`.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `MCPConfig` | -- | The config object to validate |
| `options.level` | `1 \| 2 \| 3` | `3` | Validation strictness level |

**Validation levels:**

| Level | Checks |
|---|---|
| 1 | JSON syntax only |
| 2 | JSON syntax + schema structure (mcpServers present, entries valid) |
| 3 | All checks including URL format validation and non-empty command warnings |

**Returns:** `Promise<ValidationResult>` with the following shape:

```typescript
interface ValidationResult {
  valid: boolean;             // true only when no error-severity checks fail
  configPath: string;         // path to the validated config file
  checks: ValidationCheck[];  // individual check results
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  completenessScore: number;  // 0-100
}
```

**Completeness score:** starts at 100, reduced by 30 per error-severity failure and 10 per warning-severity failure, clamped to [0, 100].

```typescript
const result = await validateConfig(config, { level: 2 });
if (!result.valid) {
  for (const check of result.checks.filter(c => !c.passed)) {
    console.error(`[${check.severity}] ${check.id}: ${check.message}`);
  }
}
```

---

### `validateJsonSyntax(filePath: string): ValidationCheck`

Checks whether a file contains valid JSON.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `filePath` | `string` | Absolute path to the file to check |

**Returns:** A `ValidationCheck` with `id: 'json-syntax'` and `severity: 'error'`.

---

### `validateSchema(config: MCPConfig): ValidationCheck[]`

Runs schema-level validation checks on a parsed config.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | `MCPConfig` | The parsed config to validate |

**Returns:** An array of `ValidationCheck` objects covering:

| Check ID | Severity | Description |
|---|---|---|
| `has-mcp-servers` | error | mcpServers key exists and is an object |
| `server-entries-valid` | error | All entries have a valid transport type |
| `no-empty-names` | warning | No server names are empty strings |
| `url-format` | warning | All HTTP server URLs start with `http://` or `https://` |
| `command-non-empty` | warning | All stdio server commands are non-empty strings |

---

### `addServer(config: MCPConfig, name: string, entry: ServerEntry): void`

Adds a server entry to the config in place.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | `MCPConfig` | The config to mutate |
| `name` | `string` | Server name (key in `mcpServers`) |
| `entry` | `ServerEntry` | The server entry to add |

**Throws:** `ServerExistsError` if a server with that name already exists.

---

### `removeServer(config: MCPConfig, name: string): void`

Removes a server entry from the config in place.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | `MCPConfig` | The config to mutate |
| `name` | `string` | Server name to remove |

**Throws:** `ServerNotFoundError` if the server does not exist.

---

### `getServer(config: MCPConfig, name: string): ServerEntry | undefined`

Returns the server entry for the given name, or `undefined` if not found.

---

### `listServers(config: MCPConfig): string[]`

Returns a sorted array of all server names in the config.

---

### `createManager(options?: ManagerOptions): ConfigManager`

Creates a stateful config manager that encapsulates load, save, validate, and CRUD operations on a single config file.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `options.configPath` | `string` | `'.mcp.json'` | Path to the config file |
| `options.validationLevel` | `1 \| 2 \| 3 \| 4 \| 5` | -- | Default validation level |

**Important:** Call `manager.load()` before any other methods. Mutations (`add`, `remove`) are in-memory until `manager.save()` is called.

#### ConfigManager Methods

| Method | Signature | Description |
|---|---|---|
| `load` | `(): Promise<void>` | Load config from disk |
| `save` | `(): Promise<void>` | Persist current config to disk |
| `getConfig` | `(): MCPConfig` | Return the loaded config object |
| `list` | `(): string[]` | Return sorted array of server names |
| `get` | `(name: string): ServerEntry \| undefined` | Return a server entry by name |
| `has` | `(name: string): boolean` | Check if a server exists |
| `add` | `(name: string, entry: ServerEntry): void` | Add a server (throws `ServerExistsError` if exists) |
| `addFromRegistry` | `(name: string, envValues?: Record<string, string>): void` | Add a server from the built-in registry |
| `remove` | `(name: string): void` | Remove a server (throws `ServerNotFoundError` if missing) |
| `validate` | `(options?: { level?: 1-5 }): Promise<ValidationResult>` | Validate the current config |

```typescript
const manager = createManager({ configPath: '.mcp.json' });
await manager.load();

manager.add('github', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
});

const result = await manager.validate();
console.log(result.completenessScore);

await manager.save();
```

## Configuration

### Config File Format

MCP configuration files are JSON files with a top-level `mcpServers` key:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    },
    "remote-api": {
      "url": "https://mcp.example.com/api",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

### Stdio Server Entry Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `command` | `string` | Yes | Executable to run (`npx`, `node`, `uvx`, `docker`) |
| `args` | `string[]` | No | Arguments passed to the command |
| `env` | `Record<string, string>` | No | Environment variables for the subprocess |
| `cwd` | `string` | No | Working directory for the subprocess |
| `disabled` | `boolean` | No | If true, the server is configured but not started |

### HTTP Server Entry Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | Yes | URL of the MCP server HTTP endpoint |
| `headers` | `Record<string, string>` | No | HTTP headers sent with requests |
| `disabled` | `boolean` | No | If true, the server is configured but not connected |

### Config File Locations

| Location | Scope | Used By | Path |
|---|---|---|---|
| Project config | Per-project | Claude Code | `<project>/.mcp.json` |
| Claude Desktop | Global | Claude Desktop | `~/.claude/claude_desktop_config.json` |
| Cursor | Per-user | Cursor IDE | `~/.cursor/mcp.json` |
| Windsurf | Per-user | Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline | Per-user | Cline (VS Code) | `~/.cline/mcp_settings.json` |

All locations use the same `mcpServers` format. Files containing additional non-MCP keys (such as Claude Desktop config) are handled safely -- extra keys are preserved across load and save operations.

## Error Handling

All errors extend `MCPConfigError`, which itself extends `Error`. Every error has a `code` string property for programmatic matching.

| Error Class | Code | When Thrown |
|---|---|---|
| `MCPConfigError` | *(varies)* | Base class for all package errors |
| `ConfigNotFoundError` | `CONFIG_NOT_FOUND` | `loadConfig()` when the file does not exist |
| `ConfigParseError` | `CONFIG_PARSE_ERROR` | `loadConfig()` when the file is not valid JSON |
| `ServerExistsError` | `SERVER_EXISTS` | `addServer()` / `manager.add()` when the name is taken |
| `ServerNotFoundError` | `SERVER_NOT_FOUND` | `removeServer()` / `manager.remove()` when the name is missing |
| `ValidationError` | `VALIDATION_ERROR` | When validation fails at a critical level |

### Error Properties

```typescript
import { ConfigNotFoundError, ConfigParseError, MCPConfigError } from 'mcp-config-ts';

try {
  loadConfig('/missing/.mcp.json');
} catch (err) {
  if (err instanceof ConfigNotFoundError) {
    console.error(err.code);       // 'CONFIG_NOT_FOUND'
    console.error(err.configPath); // '/missing/.mcp.json'
  }
}

try {
  loadConfig('/bad-json/.mcp.json');
} catch (err) {
  if (err instanceof ConfigParseError) {
    console.error(err.code);       // 'CONFIG_PARSE_ERROR'
    console.error(err.configPath); // '/bad-json/.mcp.json'
    console.error(err.parseError); // original SyntaxError, if available
  }
}
```

### Catching All Package Errors

```typescript
try {
  // any mcp-config-ts operation
} catch (err) {
  if (err instanceof MCPConfigError) {
    console.error(`[${err.code}] ${err.message}`);
  }
}
```

## Advanced Usage

### Round-Trip Preservation

When working with config files that contain non-MCP keys (such as Claude Desktop's global config), the library preserves those keys automatically:

```typescript
// Original file: { "theme": "dark", "mcpServers": { ... } }
const config = loadConfig('claude_desktop_config.json');
addServer(config, 'new-server', { type: 'stdio', command: 'node', args: ['srv.js'] });
saveConfig(config);
// Written file still contains "theme": "dark"
```

### Stateful Config Manager

The `ConfigManager` is useful when you need to perform multiple operations on the same config file:

```typescript
const manager = createManager({ configPath: '.mcp.json' });
await manager.load();

// Check before mutating
if (!manager.has('github')) {
  manager.add('github', {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
  });
}

// Validate before saving
const result = await manager.validate({ level: 3 });
if (result.valid) {
  await manager.save();
} else {
  console.error('Validation failed:', result.summary);
}
```

### Validation in CI

Run config validation as part of a CI pipeline to catch misconfigurations before they reach the main branch:

```typescript
import { loadConfig, validateConfig } from 'mcp-config-ts';

const config = loadConfig('.mcp.json');
const result = await validateConfig(config, { level: 3 });

if (!result.valid) {
  console.error(`Validation failed (score: ${result.completenessScore}/100)`);
  for (const check of result.checks.filter(c => !c.passed)) {
    console.error(`  [${check.severity}] ${check.id}: ${check.message}`);
  }
  process.exit(1);
}
```

### Programmatic Config Generation

Build config files programmatically for project scaffolding or automation:

```typescript
import { saveConfig } from 'mcp-config-ts';
import type { MCPConfig } from 'mcp-config-ts';

const config: MCPConfig = {
  servers: {
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    },
    github: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
    },
  },
  filePath: '/path/to/project/.mcp.json',
};

saveConfig(config);
```

## CLI Commands

The package ships a CLI accessible as `mcp-config`:

```
mcp-config validate [--config <path>] [--level <1-3>] [--format json]
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

**Global options:** `--config <path>`, `--format human|json`, `--quiet`, `--version`, `--help`

## TypeScript

This package is written in TypeScript and ships with full type declarations (`dist/index.d.ts`). All public types are exported from the package entry point:

```typescript
import type {
  MCPConfig,
  StdioServerEntry,
  HttpServerEntry,
  ServerEntry,
  ValidationCheck,
  ValidationResult,
  SyncOptions,
  SyncResult,
  ServerInfo,
  DiscoverOptions,
  ManagerOptions,
  ConfigManager,
  RegistryEntry,
} from 'mcp-config-ts';
```

### Type Summary

| Type | Description |
|---|---|
| `MCPConfig` | Parsed MCP configuration with `servers`, `filePath`, and optional `_otherKeys` |
| `StdioServerEntry` | Server entry for stdio transport (`command`, `args`, `env`, `cwd`, `disabled`) |
| `HttpServerEntry` | Server entry for HTTP transport (`url`, `headers`, `disabled`) |
| `ServerEntry` | Union of `StdioServerEntry \| HttpServerEntry` |
| `ValidationCheck` | Individual validation check result (`id`, `severity`, `passed`, `message`) |
| `ValidationResult` | Full validation result with `valid`, `checks`, `summary`, `completenessScore` |
| `SyncOptions` | Options for syncing configs (`source`, `target`, `conflictStrategy`, `dryRun`) |
| `SyncResult` | Result of a sync operation (`added`, `updated`, `skipped`, `errors`, `changed`) |
| `ServerInfo` | Discoverable MCP server info (`name`, `npmPackage`, `category`, `source`) |
| `DiscoverOptions` | Options for server discovery (`searchNpm`, `limit`) |
| `ManagerOptions` | Options for `createManager()` (`configPath`, `validationLevel`) |
| `ConfigManager` | Stateful config manager interface with `load`, `save`, `add`, `remove`, `validate` |
| `RegistryEntry` | Built-in server registry entry with config template and env var metadata |

## License

MIT
