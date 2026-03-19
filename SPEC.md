# mcp-config-ts -- Specification

## 1. Overview

`mcp-config-ts` is a CLI tool and programmatic library for discovering, adding, validating, and syncing MCP (Model Context Protocol) server configurations across `.mcp.json` files in all of a developer's projects. It reads and writes the JSON configuration files that MCP-compatible tools (Claude Code, Claude Desktop, Cursor, Windsurf, Cline) use to know which MCP servers to connect to, what command to run, and what environment variables to set. It provides a single interface for managing the full lifecycle of MCP server configuration: searching a registry for available servers, adding them to a project's config with the correct command, arguments, and env vars, validating that the config is correct and complete, and syncing configs across projects so that a server added in one project can be propagated to others without manual JSON editing.

The gap this package fills is specific and well-defined. MCP servers are proliferating -- there are hundreds on npm (`@modelcontextprotocol/server-*`, `@anthropic/mcp-*`, and many community-published packages), and developers routinely use 5-15 servers across their projects. Each server requires a configuration entry specifying its transport type (stdio or HTTP), the command to run (for stdio: `npx`, `node`, `uvx`, `docker`), arguments, and environment variables (API keys, tokens, database URLs). Today, adding a server means manually editing a JSON file, looking up the correct package name, figuring out the right arguments, and setting up environment variables. Copying a server config from one project to another means opening two JSON files side by side. Verifying that a config is correct -- that the command exists, the npm package is real, the env vars are set -- requires manual checking. No tool in the MCP ecosystem automates any of this. `mcp-config-ts` automates all of it.

The design has two layers. The programmatic API provides typed functions for loading, validating, modifying, and syncing MCP config files. It returns structured results (`MCPConfig`, `ValidationResult`, `SyncResult`) that callers can inspect and act on. The CLI wraps the API with commands (`mcp-config list`, `mcp-config add`, `mcp-config validate`, `mcp-config sync`, `mcp-config search`, `mcp-config doctor`) that cover the full workflow from discovery to validation. Both layers are designed to work across config file locations: project-level `.mcp.json` files, the global Claude Desktop config at `~/.claude/claude_desktop_config.json`, and tool-specific config paths for Cursor, Windsurf, and Cline. A built-in server registry provides config templates for popular MCP servers, so `mcp-config add github` generates the correct entry without the developer needing to know that the package is `@modelcontextprotocol/server-github` or that it requires a `GITHUB_TOKEN` environment variable.

---

## 2. Goals and Non-Goals

### Goals

- Provide a CLI (`mcp-config`) with commands for listing, adding, removing, validating, syncing, and searching MCP server configurations across config files.
- Provide a programmatic TypeScript/JavaScript API (`loadConfig`, `validateConfig`, `addServer`, `removeServer`, `syncConfigs`, `discoverServers`, `createManager`) for embedding in other tools, IDE extensions, and automation scripts.
- Support all MCP config file locations: project-level `.mcp.json`, global `~/.claude/claude_desktop_config.json` (Claude Desktop), and tool-specific paths for Cursor (`~/.cursor/mcp.json`), Windsurf (`~/.codeium/windsurf/mcp_config.json`), and Cline (`~/.cline/mcp_settings.json`).
- Validate config files comprehensively: JSON syntax, schema correctness, command existence, npm package existence, environment variable presence, transport type consistency, and duplicate server name detection.
- Ship a built-in server registry with config templates for popular MCP servers (filesystem, github, gitlab, slack, postgres, sqlite, brave-search, puppeteer, memory, sequential-thinking, and others), so `mcp-config add <name>` generates the correct config entry without manual lookup.
- Support searching for MCP servers by querying the npm registry for packages matching MCP server naming patterns.
- Sync configs between config files: copy servers from one project to another, promote a project server to the global config, demote a global server to a specific project, and merge configs with configurable conflict strategies.
- Handle environment variables carefully: detect required env vars per server from the registry, check if they are set in the shell, prompt for missing values during interactive `add`, integrate with `.env` files, and never log or display actual secret values.
- Keep dependencies minimal: no CLI framework dependency (use Node.js built-in `util.parseArgs`), no HTTP framework dependency, no config file parsing library beyond Node.js built-in JSON parsing.

### Non-Goals

- **Not an MCP server runtime.** This package manages configuration files. It does not start, stop, or communicate with MCP servers. For server health checking, use `mcp-healthcheck`. For protocol-level debugging, use the MCP Inspector.
- **Not a protocol validator.** This package validates config file structure (JSON schema, required fields, correct transport configuration). It does not validate MCP protocol conformance, schema quality, or server behavior. For protocol and schema validation, use `mcp-schema-lint`.
- **Not an MCP server registry service.** The built-in registry is a static database of known servers shipped with the package. It is not an online registry service, does not host packages, and does not require network access (except for `search`, which queries the npm registry). The registry is maintained by updating the package.
- **Not a secrets manager.** This package checks whether required environment variables are set and prompts for values during interactive `add`, but it does not store, encrypt, or manage secrets. For secret management, use a dedicated tool (1Password CLI, `dotenv-vault`, AWS Secrets Manager). `mcp-config-ts` integrates with `.env` files but does not replace a secrets manager.
- **Not a continuous sync daemon.** This package performs one-time config operations (add, remove, sync). It does not watch for file changes, automatically propagate updates, or run in the background. If a server is added to one project and needs to be added to another, the developer runs `mcp-config sync` explicitly.
- **Not an AI tool configuration manager.** This package manages MCP server configuration (the `mcpServers` section of config files). It does not manage AI instruction files (`CLAUDE.md`, `.cursorrules`), tool preferences, or model settings. For AI config file generation, use `ai-env-init`.

---

## 3. Target Users and Use Cases

### Individual Developers Managing Multiple MCP Servers

A developer uses 10 MCP servers: filesystem, github, gitlab, slack, postgres, brave-search, puppeteer, memory, sequential-thinking, and a custom internal server. They have 6 active projects. Adding a new MCP server today means editing `.mcp.json` in each project, copying the JSON entry, and verifying the env vars are set. With `mcp-config-ts`, they run `mcp-config add brave-search`, answer one prompt for the `BRAVE_API_KEY`, and the server is added to the current project's `.mcp.json`. Then `mcp-config sync .mcp.json ~/other-project/.mcp.json` copies it to another project. `mcp-config doctor` verifies everything is correct.

### Teams Standardizing MCP Configurations

A team of 8 developers has agreed on a standard set of MCP servers for their project: github, postgres, memory, and a custom internal tool server. The tech lead creates the canonical `.mcp.json`, commits it to the repo, and adds `mcp-config validate` to the CI pipeline. When a new developer clones the repo, they run `mcp-config doctor` to verify that all required env vars are set and all commands are available. The CI step catches config corruption before it reaches production.

### Developers Discovering New MCP Servers

A developer hears about MCP servers for Brave Search and wants to add one. Today, they would search npm, find the package name, look up the README for the correct command and arguments, and manually edit their `.mcp.json`. With `mcp-config-ts`, they run `mcp-config search brave`, see the matching server with its description, and run `mcp-config add brave-search`. The registry knows the package name, command, arguments, and required env vars. The developer only needs to provide the API key.

### Developers Migrating Between AI Tools

A developer has been using Claude Desktop with `~/.claude/claude_desktop_config.json` and wants to start using Claude Code with project-level `.mcp.json` files. They run `mcp-config sync --from claude-desktop --to .mcp.json` to copy all their MCP server configs from the global Claude Desktop config to the current project. Or they switch from Cursor to Windsurf and need to migrate their MCP configs: `mcp-config sync --from cursor --to windsurf` handles the file path differences.

### CI/CD Config Validation

A GitHub Actions workflow validates the project's `.mcp.json` on every pull request to catch misconfigurations (typos in server names, missing required env var declarations, invalid transport configurations) before they reach the main branch.

### Project Bootstrapping

A developer starts a new project and wants to set up MCP servers. They run `mcp-config init` to create a `.mcp.json` with sensible defaults, then `mcp-config add github` and `mcp-config add filesystem` to add the servers they need. The entire setup takes under a minute.

---

## 4. Core Concepts

### MCP Configuration File

An MCP configuration file is a JSON file that declares which MCP servers a tool should connect to. The canonical format is a JSON object with a top-level `mcpServers` key whose value is an object mapping server names to server entry objects. The file is read by MCP-compatible tools (Claude Code, Claude Desktop, Cursor, Windsurf, Cline) at startup to determine which servers to launch or connect to.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

### Server Entry

A server entry is a single MCP server's configuration within the `mcpServers` object. The key is the server's local name (chosen by the developer, used to identify the server in tool UIs). The value specifies how to connect to the server: via stdio transport (a command to spawn as a subprocess) or HTTP transport (a URL to connect to).

### Transport Types

MCP supports two transport types for server connections:

- **stdio**: The tool spawns the MCP server as a subprocess and communicates via stdin/stdout using newline-delimited JSON-RPC. The config specifies `command` (the executable), `args` (command-line arguments), and `env` (environment variables). This is the most common transport for local MCP servers distributed as npm packages or Python packages.
- **HTTP (Streamable HTTP)**: The tool connects to the MCP server at a URL and communicates via HTTP POST with optional SSE streaming. The config specifies `url` and optional `headers`. This is used for remote MCP servers running as web services.

### Config File Locations

MCP configuration files live in multiple locations, each serving a different scope:

| Location | Scope | Used By | Path |
|---|---|---|---|
| Project `.mcp.json` | Per-project | Claude Code | `<project-root>/.mcp.json` |
| Claude Desktop global | Global | Claude Desktop | `~/.claude/claude_desktop_config.json` |
| Cursor config | Per-user | Cursor IDE | `~/.cursor/mcp.json` |
| Windsurf config | Per-user | Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline config | Per-user | Cline (VS Code) | `~/.cline/mcp_settings.json` |

All locations use the same `mcpServers` format. Some tools (Claude Desktop) embed the `mcpServers` object within a larger configuration file that contains non-MCP settings; `mcp-config-ts` reads and writes only the `mcpServers` portion, preserving the rest.

### Server Registry

The server registry is a built-in database of known MCP servers. Each entry contains the server's canonical name, npm package (or other distribution), description, config template (command, args, default env vars), and required environment variables. The registry enables `mcp-config add <name>` to generate a correct config entry without the developer needing to look up package names, arguments, or env var names. The registry is shipped as a static JSON file within the `mcp-config-ts` package and updated by publishing new versions.

### Config Validation

Config validation is the process of checking a config file for correctness and completeness. Validation operates at multiple levels: JSON syntax (is it valid JSON?), schema structure (does it have `mcpServers` with correct shape?), command existence (is `npx` / `node` / `uvx` in PATH?), package existence (does the npm package exist?), env var presence (are required environment variables set?), and consistency (no duplicate names, no mixed transport types in a single entry).

### Config Syncing

Config syncing copies MCP server entries between config files. A sync operation has a source config, a target config, and a merge strategy. Merge strategies handle conflicts when the target already has a server with the same name: `skip` leaves the existing entry unchanged, `overwrite` replaces it with the source's entry, and `merge-env` keeps the target's entry but adds any env vars from the source that the target is missing.

---

## 5. Config File Format

### JSON Schema

The MCP configuration file follows this structure:

```json
{
  "mcpServers": {
    "<server-name>": <ServerEntry>,
    ...
  }
}
```

The complete JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["mcpServers"],
  "additionalProperties": true,
  "properties": {
    "mcpServers": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/ServerEntry"
      }
    }
  },
  "definitions": {
    "ServerEntry": {
      "type": "object",
      "oneOf": [
        { "$ref": "#/definitions/StdioServerEntry" },
        { "$ref": "#/definitions/HttpServerEntry" }
      ]
    },
    "StdioServerEntry": {
      "type": "object",
      "required": ["command"],
      "properties": {
        "command": {
          "type": "string",
          "description": "The executable to run (e.g., 'npx', 'node', 'uvx', 'docker')."
        },
        "args": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Arguments to pass to the command."
        },
        "env": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "Environment variables to set for the subprocess."
        },
        "cwd": {
          "type": "string",
          "description": "Working directory for the subprocess."
        },
        "disabled": {
          "type": "boolean",
          "description": "If true, the server is configured but not started."
        }
      },
      "additionalProperties": false
    },
    "HttpServerEntry": {
      "type": "object",
      "required": ["url"],
      "properties": {
        "url": {
          "type": "string",
          "format": "uri",
          "description": "The URL of the MCP server's HTTP endpoint."
        },
        "headers": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "HTTP headers to include in requests (e.g., Authorization)."
        },
        "disabled": {
          "type": "boolean",
          "description": "If true, the server is configured but not connected."
        }
      },
      "additionalProperties": false
    }
  }
}
```

### Stdio Server Entry

A stdio server entry specifies a command to spawn as a subprocess:

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "ghp_abc123def456"
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `command` | string | Yes | The executable to run. Common values: `npx`, `node`, `uvx`, `docker`, `python`, `deno`. |
| `args` | string[] | No | Arguments to pass to the command. For `npx`, typically `["-y", "<package-name>"]` followed by server-specific args. |
| `env` | Record<string, string> | No | Environment variables for the subprocess. Merged with the tool's environment. |
| `cwd` | string | No | Working directory for the subprocess. Defaults to the project root. |
| `disabled` | boolean | No | If `true`, the server is configured but not started. Used to temporarily disable a server without removing its config. |

### HTTP Server Entry

An HTTP server entry specifies a URL to connect to:

```json
{
  "url": "https://mcp.example.com/sse",
  "headers": {
    "Authorization": "Bearer sk-..."
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string (URI) | Yes | The HTTP endpoint of the MCP server. |
| `headers` | Record<string, string> | No | HTTP headers to include in every request. Typically used for authentication. |
| `disabled` | boolean | No | If `true`, the server is configured but not connected. |

### Environment Variable Handling

Environment variables in server entries can contain literal values or references to environment variables in the developer's shell. `mcp-config-ts` treats all values as literal strings (consistent with how MCP tools interpret them), but provides tooling to detect, validate, and manage env vars:

- **Literal values**: The env var value is the actual secret. Example: `"GITHUB_TOKEN": "ghp_abc123"`. This is the simplest form but means secrets are stored in plain text in the config file.
- **Shell-variable references**: Some developers use a convention of referencing shell environment variables. Example: `"GITHUB_TOKEN": "${GITHUB_TOKEN}"`. MCP tools do not universally expand `${...}` syntax (behavior varies by tool), so `mcp-config-ts` does not interpret these references but does detect them during validation and warns when the referenced shell variable is not set.
- **Empty/placeholder values**: During `mcp-config add`, if the developer does not provide a value for a required env var, `mcp-config-ts` inserts a placeholder: `"GITHUB_TOKEN": "<your-github-token>"`. Validation flags these placeholders as incomplete.

### Config File Variations by Tool

While all tools use the `mcpServers` format, some tools embed it within a larger config structure:

**Claude Desktop** (`~/.claude/claude_desktop_config.json`):
```json
{
  "theme": "dark",
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  }
}
```

`mcp-config-ts` reads and writes only the `mcpServers` key, preserving all other keys in the file.

**Claude Code** (`.mcp.json` in project root):
```json
{
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  }
}
```

A pure MCP config file with no other keys.

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  }
}
```

**Cline** (`~/.cline/mcp_settings.json`):
```json
{
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  }
}
```

Cline wraps server entries in an additional structure with `autoApprove` arrays and `disabled` flags at the tool level. `mcp-config-ts` handles these variations transparently.

---

## 6. Server Registry

### Registry Structure

The built-in server registry is a JSON file (`registry.json`) shipped inside the `mcp-config-ts` package. Each entry contains everything needed to generate a complete server config entry:

```typescript
interface RegistryEntry {
  /** Canonical short name used in `mcp-config add <name>`. */
  name: string;

  /** Human-readable description of what this server does. */
  description: string;

  /** npm package name. */
  npmPackage: string;

  /** Category for grouping in search results. */
  category: 'official' | 'community' | 'database' | 'search' | 'productivity' | 'dev-tools' | 'ai' | 'other';

  /** Default config template for stdio transport. */
  config: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };

  /** Environment variables required by this server. */
  requiredEnvVars: Array<{
    name: string;
    description: string;
    example: string;
    sensitive: boolean;
  }>;

  /** Optional environment variables. */
  optionalEnvVars?: Array<{
    name: string;
    description: string;
    example: string;
    default?: string;
    sensitive: boolean;
  }>;

  /** npm keywords for search matching. */
  keywords: string[];

  /** URL to the server's documentation or repository. */
  homepage?: string;
}
```

### Built-in Registry Entries

The registry ships with config templates for the most widely used MCP servers:

| Name | npm Package | Category | Required Env Vars | Description |
|---|---|---|---|---|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | official | None (paths via args) | Read/write access to local filesystem directories. |
| `github` | `@modelcontextprotocol/server-github` | official | `GITHUB_TOKEN` | GitHub API: repos, issues, PRs, code search. |
| `gitlab` | `@modelcontextprotocol/server-gitlab` | official | `GITLAB_TOKEN`, `GITLAB_URL` | GitLab API: projects, merge requests, issues. |
| `slack` | `@modelcontextprotocol/server-slack` | official | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` | Slack: channels, messages, users. |
| `postgres` | `@modelcontextprotocol/server-postgres` | database | `POSTGRES_URL` | PostgreSQL: schema inspection, query execution. |
| `sqlite` | `@modelcontextprotocol/server-sqlite` | database | None (path via args) | SQLite: schema inspection, query execution. |
| `brave-search` | `@modelcontextprotocol/server-brave-search` | search | `BRAVE_API_KEY` | Brave Search API: web and local search. |
| `puppeteer` | `@modelcontextprotocol/server-puppeteer` | dev-tools | None | Browser automation: navigate, screenshot, interact. |
| `memory` | `@modelcontextprotocol/server-memory` | ai | None | Persistent memory via knowledge graph. |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking` | ai | None | Structured sequential reasoning tool. |
| `everything` | `@modelcontextprotocol/server-everything` | official | None | Reference server exercising all MCP features. |
| `fetch` | `@modelcontextprotocol/server-fetch` | official | None | Fetch web content and convert to markdown. |
| `google-maps` | `@modelcontextprotocol/server-google-maps` | official | `GOOGLE_MAPS_API_KEY` | Google Maps: geocoding, directions, places. |
| `sentry` | `@modelcontextprotocol/server-sentry` | dev-tools | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` | Sentry: error tracking, issue management. |
| `cloudflare` | `@cloudflare/mcp-server-cloudflare` | community | `CLOUDFLARE_API_TOKEN` | Cloudflare: Workers, KV, D1, R2 management. |
| `linear` | `@anthropic/mcp-server-linear` | productivity | `LINEAR_API_KEY` | Linear: issues, projects, teams. |
| `notion` | `@anthropic/mcp-server-notion` | productivity | `NOTION_API_KEY` | Notion: pages, databases, blocks. |

### Registry Search

When a developer runs `mcp-config search <query>`, the tool searches the built-in registry first (matching against `name`, `description`, `keywords`, and `npmPackage`), then optionally queries the npm registry for packages matching MCP server naming patterns (`@modelcontextprotocol/server-*`, `mcp-server-*`, `*-mcp-server`).

**Built-in registry search** is local and instant. It uses a simple substring match with ranking: exact name match scores highest, followed by keyword match, then description match.

**npm registry search** requires network access and is opt-in (`mcp-config search --npm <query>`). It queries the npm registry search API (`https://registry.npmjs.org/-/v1/search?text=mcp+server+<query>`) and returns packages that appear to be MCP servers based on their name, keywords, or description. npm search results include the package name, description, version, and weekly downloads, but no config template -- the developer must configure these servers manually or contribute a registry entry.

### Registry Maintenance

The registry is maintained as a static JSON file within the `mcp-config-ts` package source. Adding a new server means:

1. Adding an entry to `src/registry/registry.json`.
2. Publishing a new version of `mcp-config-ts`.

Community contributions are encouraged via pull requests. The registry does not auto-update or fetch remote registry data at runtime (except for the explicit `--npm` search flag). This keeps the tool predictable and offline-capable.

---

## 7. Config Validation

### Validation Levels

Config validation operates at five levels, from basic to comprehensive. Each level subsumes the checks from the previous level:

**Level 1: JSON Syntax**
- Is the file valid JSON?
- Error if the file is empty, contains trailing commas, has unquoted keys, or is otherwise malformed JSON.

**Level 2: Schema Structure**
- Does the top-level object have an `mcpServers` key?
- Is `mcpServers` an object (not array, string, null)?
- Does each server entry have the required fields for its transport type? (stdio entries must have `command`; HTTP entries must have `url`.)
- Are field types correct? (`command` is string, `args` is string array, `env` is object of string values, `url` is string.)
- Are there unknown fields that indicate a typo or misconfiguration?

**Level 3: Transport Consistency**
- Does each entry use exactly one transport type? (Having both `command` and `url` in the same entry is invalid.)
- For stdio entries: is `command` a non-empty string? Are `args` an array of strings (not numbers or objects)?
- For HTTP entries: is `url` a syntactically valid URL? Does it use `http://` or `https://` scheme?

**Level 4: Command and Package Existence** (requires system access)
- For stdio entries: is the `command` executable available in PATH? (`npx`, `node`, `uvx`, `docker`, `python`, etc.)
- For stdio entries using `npx`: does the npm package in `args` exist on the npm registry? (e.g., if `args` contains `@modelcontextprotocol/server-github`, does that package exist?)
- For HTTP entries: is the URL reachable? (Optional check, disabled by default because it requires network access.)

**Level 5: Environment Variable Presence** (requires system access)
- For each server entry, does the registry specify required env vars? If so, are they present in the `env` field?
- For env vars in the `env` field, are the corresponding environment variables set in the developer's shell? (This catches configs that reference `${VAR_NAME}` where `VAR_NAME` is not set.)
- Are there placeholder values (`<your-...>`, `TODO`, `xxx`) that indicate incomplete configuration?

### Validation Result

```typescript
interface ValidationResult {
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

interface ValidationCheck {
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
```

### Completeness Score

The completeness score is a percentage (0-100) reflecting how complete and correct the config is. It is computed as:

- 100 points for valid JSON syntax.
- Minus 30 points per schema structure error.
- Minus 20 points per transport consistency error.
- Minus 10 points per missing command.
- Minus 10 points per missing required env var.
- Minus 5 points per warning (placeholder values, optional env vars missing).

The score floors at 0. A score of 80+ indicates a config that is likely to work correctly. A score below 50 indicates significant issues.

### Duplicate Server Name Detection

If two entries in `mcpServers` have the same key, JSON parsing silently uses the last one. The validator detects this by performing a raw text scan for duplicate keys before JSON parsing. This catches a common mistake when manually editing config files.

---

## 8. Config Syncing

### Sync Operation

A sync operation copies MCP server entries from a source config file to a target config file. The source and target can be any combination of config file locations (project `.mcp.json`, global Claude Desktop config, Cursor config, etc.).

```typescript
interface SyncOptions {
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
```

### Conflict Strategies

| Strategy | Behavior |
|---|---|
| `skip` | If the target already has a server with the same name, leave it unchanged. Only add servers that are new to the target. |
| `overwrite` | Replace the target's entry with the source's entry. The source's config wins completely. |
| `merge-env` | Keep the target's entry but merge env vars from the source. If the source has env vars the target lacks, add them. If both have the same env var, keep the target's value (it may have been customized). |

The default strategy is `skip`, which is the safest option.

### Sync Result

```typescript
interface SyncResult {
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
```

### Tool Aliases

Instead of specifying full paths, developers can use tool aliases that resolve to the correct platform-specific path:

| Alias | Resolves To (macOS) | Resolves To (Linux) | Resolves To (Windows) |
|---|---|---|---|
| `claude-desktop` | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.config/claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` |
| `cursor` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` | `%USERPROFILE%\.cursor\mcp.json` |
| `windsurf` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` |
| `cline` | `~/.cline/mcp_settings.json` | `~/.cline/mcp_settings.json` | `%USERPROFILE%\.cline\mcp_settings.json` |

The `.mcp.json` in the current working directory is the default target when no target is specified.

### Diff Before Sync

When `dryRun` is `true`, the sync operation returns a `SyncResult` showing what would change without modifying any files. The CLI presents this as a human-readable diff:

```
$ mcp-config sync claude-desktop .mcp.json --dry-run

  Sync: ~/.claude/claude_desktop_config.json → .mcp.json

  + github         (add)     command: npx -y @modelcontextprotocol/server-github
  + brave-search   (add)     command: npx -y @modelcontextprotocol/server-brave-search
  ~ postgres       (skip)    already exists in target
  + memory         (add)     command: npx -y @modelcontextprotocol/server-memory

  Summary: 3 to add, 0 to update, 1 to skip
  Run without --dry-run to apply.
```

---

## 9. API Design

### Installation

```bash
npm install mcp-config-ts
```

### Main Exports

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
```

### Type Definitions

```typescript
// ── Config Types ─────────────────────────────────────────────────────

/** A parsed MCP configuration. */
interface MCPConfig {
  /** The servers declared in this config. */
  servers: Record<string, ServerEntry>;

  /** The file path this config was loaded from. */
  filePath: string;

  /** Non-MCP keys in the original file, preserved for round-trip writing. */
  _otherKeys?: Record<string, unknown>;
}

/** A stdio server entry. */
interface StdioServerEntry {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

/** An HTTP server entry. */
interface HttpServerEntry {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/** A server entry (stdio or HTTP). */
type ServerEntry = StdioServerEntry | HttpServerEntry;

// ── Validation Types ─────────────────────────────────────────────────

/** Result of config validation. */
interface ValidationResult {
  valid: boolean;
  configPath: string;
  checks: ValidationCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  completenessScore: number;
}

interface ValidationCheck {
  id: string;
  severity: 'error' | 'warning';
  passed: boolean;
  message: string;
  serverName?: string;
  suggestion?: string;
}

// ── Sync Types ───────────────────────────────────────────────────────

interface SyncOptions {
  source: string;
  target: string;
  servers?: string[];
  conflictStrategy: 'skip' | 'overwrite' | 'merge-env';
  dryRun: boolean;
}

interface SyncResult {
  sourcePath: string;
  targetPath: string;
  added: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ serverName: string; error: string }>;
  changed: boolean;
}

// ── Discovery Types ──────────────────────────────────────────────────

/** Information about a discoverable MCP server. */
interface ServerInfo {
  name: string;
  description: string;
  npmPackage: string;
  category: string;
  requiredEnvVars: Array<{ name: string; description: string; sensitive: boolean }>;
  source: 'registry' | 'npm';
  weeklyDownloads?: number;
  homepage?: string;
}

// ── Manager Types ────────────────────────────────────────────────────

interface ManagerOptions {
  /** Default config file path. Defaults to `.mcp.json` in cwd. */
  configPath?: string;

  /** Validation level for automatic validation. */
  validationLevel?: 1 | 2 | 3 | 4 | 5;
}
```

### `loadConfig(path?): Promise<MCPConfig>`

Loads and parses an MCP config file.

```typescript
const config = await loadConfig('.mcp.json');
console.log(Object.keys(config.servers)); // ['github', 'filesystem']
```

**Behavior:**
- If `path` is omitted, loads `.mcp.json` from the current working directory.
- If `path` is a tool alias (`'claude-desktop'`, `'cursor'`, `'windsurf'`, `'cline'`), resolves to the platform-specific path.
- If the file does not exist, throws `ConfigNotFoundError`.
- If the file is not valid JSON, throws `ConfigParseError`.
- Infers transport type from the presence of `command` (stdio) or `url` (HTTP) in each entry.
- Preserves non-`mcpServers` keys in `_otherKeys` for round-trip saving.

### `saveConfig(config: MCPConfig, path?): Promise<void>`

Writes an MCP config to disk.

```typescript
await saveConfig(config, '.mcp.json');
```

**Behavior:**
- If `path` is omitted, writes to `config.filePath`.
- Merges `config.servers` back into the `mcpServers` key.
- Preserves `_otherKeys` so that non-MCP settings in the file are not lost.
- Formats the JSON with 2-space indentation.
- Creates parent directories if they do not exist.

### `validateConfig(config: MCPConfig, options?): Promise<ValidationResult>`

Validates an MCP config against all validation levels.

```typescript
const result = await validateConfig(config, { level: 5 });
if (!result.valid) {
  for (const check of result.checks.filter(c => !c.passed)) {
    console.error(`${check.severity}: ${check.message}`);
  }
}
```

**Options:**
| Option | Type | Default | Description |
|---|---|---|---|
| `level` | `1 \| 2 \| 3 \| 4 \| 5` | `3` | Highest validation level to run. |
| `checkNpm` | `boolean` | `false` | Whether to verify npm package existence (Level 4). |
| `checkEnv` | `boolean` | `true` | Whether to check env var presence in shell (Level 5). |

### `addServer(config: MCPConfig, serverName: string, entry: ServerEntry): MCPConfig`

Adds a server entry to a config. Returns a new config object (does not mutate the input).

```typescript
const updated = addServer(config, 'github', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: 'ghp_...' },
});
await saveConfig(updated);
```

**Behavior:**
- If `serverName` already exists in the config, throws `ServerExistsError`.
- Does not write to disk. The caller must call `saveConfig` to persist.

### `addServerFromRegistry(config: MCPConfig, registryName: string, envValues?: Record<string, string>): MCPConfig`

Adds a server from the built-in registry by its registry name. Looks up the server's config template and required env vars, applies the provided env values, and adds the entry.

```typescript
const updated = addServerFromRegistry(config, 'github', {
  GITHUB_TOKEN: 'ghp_abc123',
});
```

**Behavior:**
- If `registryName` is not found in the registry, throws `ServerNotFoundError`.
- If required env vars are not provided in `envValues`, inserts placeholder values and returns the config (the caller can validate or prompt later).

### `removeServer(config: MCPConfig, serverName: string): MCPConfig`

Removes a server entry from a config. Returns a new config object.

```typescript
const updated = removeServer(config, 'github');
await saveConfig(updated);
```

**Behavior:**
- If `serverName` does not exist, throws `ServerNotFoundError`.

### `syncConfigs(options: SyncOptions): Promise<SyncResult>`

Syncs server entries from a source config to a target config.

```typescript
const result = await syncConfigs({
  source: 'claude-desktop',
  target: '.mcp.json',
  conflictStrategy: 'skip',
  dryRun: false,
});

console.log(`Added: ${result.added.join(', ')}`);
console.log(`Skipped: ${result.skipped.join(', ')}`);
```

### `discoverServers(query?: string, options?: DiscoverOptions): Promise<ServerInfo[]>`

Searches for MCP servers in the built-in registry and optionally the npm registry.

```typescript
const servers = await discoverServers('database');
for (const s of servers) {
  console.log(`${s.name}: ${s.description}`);
}
```

**Options:**
| Option | Type | Default | Description |
|---|---|---|---|
| `searchNpm` | `boolean` | `false` | Whether to also search the npm registry. |
| `limit` | `number` | `20` | Maximum number of results to return. |

### `createManager(options?: ManagerOptions): ConfigManager`

Creates a `ConfigManager` instance that provides a stateful interface for config operations, loading the config once and providing methods that operate on the loaded state.

```typescript
const manager = createManager({ configPath: '.mcp.json' });
await manager.load();

manager.add('github', {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: 'ghp_...' },
});

const validation = await manager.validate();
await manager.save();
```

```typescript
interface ConfigManager {
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
  validate(options?: { level?: 1 | 2 | 3 | 4 | 5 }): Promise<ValidationResult>;

  /** Check if a server exists. */
  has(serverName: string): boolean;
}
```

### Error Types

```typescript
/** Base error class for mcp-config-ts errors. */
class MCPConfigError extends Error {
  code: string;
}

/** Config file not found. */
class ConfigNotFoundError extends MCPConfigError {
  code: 'CONFIG_NOT_FOUND';
  configPath: string;
}

/** Config file is not valid JSON. */
class ConfigParseError extends MCPConfigError {
  code: 'CONFIG_PARSE_ERROR';
  configPath: string;
  parseError: SyntaxError;
}

/** Server already exists in config. */
class ServerExistsError extends MCPConfigError {
  code: 'SERVER_EXISTS';
  serverName: string;
}

/** Server not found in config or registry. */
class ServerNotFoundError extends MCPConfigError {
  code: 'SERVER_NOT_FOUND';
  serverName: string;
}

/** Validation failed at a critical level. */
class ValidationError extends MCPConfigError {
  code: 'VALIDATION_ERROR';
  result: ValidationResult;
}
```

---

## 10. CLI Design

### Installation and Invocation

```bash
# Global install
npm install -g mcp-config-ts
mcp-config list

# npx (no install)
npx mcp-config-ts list

# Package script
# package.json: { "scripts": { "mcp:validate": "mcp-config validate" } }
npm run mcp:validate
```

### CLI Binary Name

`mcp-config`

### Commands

```
mcp-config <command> [options]

Commands:
  list                     List servers in the current config
  add <server>             Add a server (from registry or custom)
  remove <server>          Remove a server
  validate                 Validate the current config
  sync <source> <target>   Sync servers between configs
  search <query>           Search for MCP servers
  init                     Create a new .mcp.json
  doctor                   Diagnose config problems

Global options:
  --config <path>          Config file to operate on. Default: .mcp.json
  --format <format>        Output format: human, json. Default: human
  --quiet                  Suppress all output except errors
  --version                Print version and exit
  --help                   Print help and exit
```

### Command: `mcp-config list`

Lists all servers in the specified config file.

```
mcp-config list [options]

Options:
  --config <path>     Config file to read. Default: .mcp.json
  --all               List servers across all known config locations
  --format <format>   Output format: human, json. Default: human
```

**Human output example:**

```
$ mcp-config list

  mcp-config v0.1.0 — .mcp.json

  SERVERS (3)

  github              stdio    npx -y @modelcontextprotocol/server-github
                               env: GITHUB_TOKEN
  filesystem          stdio    npx -y @modelcontextprotocol/server-filesystem /home/user/projects
  brave-search        stdio    npx -y @modelcontextprotocol/server-brave-search
                               env: BRAVE_API_KEY
```

**With `--all`:**

```
$ mcp-config list --all

  mcp-config v0.1.0

  .mcp.json (3 servers)
    github              stdio    npx -y @modelcontextprotocol/server-github
    filesystem          stdio    npx -y @modelcontextprotocol/server-filesystem /home/user/projects
    brave-search        stdio    npx -y @modelcontextprotocol/server-brave-search

  ~/.claude/claude_desktop_config.json (5 servers)
    github              stdio    npx -y @modelcontextprotocol/server-github
    filesystem          stdio    npx -y @modelcontextprotocol/server-filesystem /tmp
    postgres            stdio    npx -y @modelcontextprotocol/server-postgres
    memory              stdio    npx -y @modelcontextprotocol/server-memory
    sequential-thinking stdio    npx -y @modelcontextprotocol/server-sequential-thinking

  ~/.cursor/mcp.json (not found)
  ~/.codeium/windsurf/mcp_config.json (not found)
  ~/.cline/mcp_settings.json (not found)
```

### Command: `mcp-config add <server>`

Adds a server to the config. If `<server>` matches a registry entry, uses the registry template. Otherwise, prompts for manual configuration.

```
mcp-config add <server> [options]

Arguments:
  server              Server name or registry identifier

Options:
  --config <path>     Config file to modify. Default: .mcp.json
  --command <cmd>     Command to run (for custom stdio servers)
  --args <args>       Comma-separated arguments
  --url <url>         URL (for HTTP servers)
  --env <key=value>   Environment variable (repeatable)
  --no-prompt         Do not prompt for missing env vars
  --name <name>       Override the server name (default: use registry name or argument)
```

**Registry server example:**

```
$ mcp-config add github

  Adding server: github
  Package: @modelcontextprotocol/server-github

  Required environment variables:
    GITHUB_TOKEN — Personal access token for GitHub API

  ? GITHUB_TOKEN: ghp_abc123def456

  Added 'github' to .mcp.json
```

**Custom server example:**

```
$ mcp-config add my-server --command node --args ./server.js --env API_KEY=sk-123

  Added 'my-server' to .mcp.json
```

**HTTP server example:**

```
$ mcp-config add remote-api --url https://mcp.example.com/sse --env Authorization="Bearer sk-..."

  Added 'remote-api' to .mcp.json
```

### Command: `mcp-config remove <server>`

Removes a server from the config.

```
mcp-config remove <server> [options]

Arguments:
  server              Name of the server to remove

Options:
  --config <path>     Config file to modify. Default: .mcp.json
  --force             Remove without confirmation
```

**Example:**

```
$ mcp-config remove github

  Remove 'github' from .mcp.json? (y/N) y
  Removed 'github' from .mcp.json
```

### Command: `mcp-config validate`

Validates the config file and reports issues.

```
mcp-config validate [options]

Options:
  --config <path>     Config file to validate. Default: .mcp.json
  --level <1-5>       Validation level. Default: 3
  --check-npm         Verify npm package existence (Level 4)
  --check-env         Check env var presence in shell (Level 5). Default: true
  --format <format>   Output format: human, json. Default: human
```

**Human output example:**

```
$ mcp-config validate --level 5

  mcp-config validate v0.1.0 — .mcp.json

  PASS  json-syntax                  Valid JSON
  PASS  schema-structure             mcpServers key present with 3 entries
  PASS  transport:github             stdio transport: command + args valid
  PASS  transport:filesystem         stdio transport: command + args valid
  PASS  transport:brave-search       stdio transport: command + args valid
  PASS  command-exists:npx           npx found in PATH
  WARN  env-missing:brave-search     BRAVE_API_KEY not set in shell environment
  PASS  env-present:github           GITHUB_TOKEN is set

  ─────────────────────────────────────────────────────────
  7 passed, 0 failed, 1 warning
  Completeness: 92/100
```

**Failed validation example:**

```
$ mcp-config validate

  mcp-config validate v0.1.0 — .mcp.json

  PASS  json-syntax                  Valid JSON
  PASS  schema-structure             mcpServers key present with 2 entries
  FAIL  transport:my-server          Server has both 'command' and 'url' — ambiguous transport
  WARN  env-placeholder:github       GITHUB_TOKEN has placeholder value '<your-github-token>'
  FAIL  command-exists:uvx           uvx not found in PATH

  ─────────────────────────────────────────────────────────
  2 passed, 2 failed, 1 warning
  Completeness: 45/100
```

### Command: `mcp-config sync <source> <target>`

Syncs servers from a source config to a target config.

```
mcp-config sync <source> <target> [options]

Arguments:
  source              Source config path or tool alias
  target              Target config path or tool alias

Options:
  --strategy <s>      Conflict strategy: skip, overwrite, merge-env. Default: skip
  --servers <names>   Comma-separated list of servers to sync (default: all)
  --dry-run           Show what would change without modifying files
  --format <format>   Output format: human, json. Default: human
```

**Example:**

```
$ mcp-config sync claude-desktop .mcp.json --dry-run

  Sync: ~/.claude/claude_desktop_config.json → .mcp.json

  + postgres       (add)     command: npx -y @modelcontextprotocol/server-postgres
  + memory         (add)     command: npx -y @modelcontextprotocol/server-memory
  ~ github         (skip)    already exists in target
  ~ filesystem     (skip)    already exists in target

  Summary: 2 to add, 0 to update, 2 to skip
  Run without --dry-run to apply.
```

### Command: `mcp-config search <query>`

Searches for MCP servers in the built-in registry and optionally npm.

```
mcp-config search <query> [options]

Arguments:
  query               Search term

Options:
  --npm               Also search the npm registry (requires network)
  --limit <n>         Maximum results. Default: 20
  --format <format>   Output format: human, json. Default: human
```

**Example:**

```
$ mcp-config search database

  mcp-config search v0.1.0

  REGISTRY RESULTS (2)

  postgres            PostgreSQL: schema inspection, query execution
                      @modelcontextprotocol/server-postgres
                      env: POSTGRES_URL

  sqlite              SQLite: schema inspection, query execution
                      @modelcontextprotocol/server-sqlite

  Run `mcp-config add <name>` to add a server.
```

**With `--npm`:**

```
$ mcp-config search database --npm

  mcp-config search v0.1.0

  REGISTRY RESULTS (2)
  [same as above]

  NPM RESULTS (5)

  @modelcontextprotocol/server-postgres   PostgreSQL MCP server       12,340/wk
  @modelcontextprotocol/server-sqlite     SQLite MCP server            8,210/wk
  mcp-server-mysql                        MySQL MCP server             3,456/wk
  mcp-server-mongodb                      MongoDB MCP server           2,100/wk
  @anthropic/mcp-server-redis             Redis MCP server             1,890/wk

  Note: npm results do not have config templates. Add them manually with
  `mcp-config add <name> --command npx --args '-y,<package>'`
```

### Command: `mcp-config init`

Creates a new `.mcp.json` file in the current directory.

```
mcp-config init [options]

Options:
  --config <path>     Output path. Default: .mcp.json
  --force             Overwrite existing file without prompting
  --with <servers>    Comma-separated list of registry servers to include
```

**Example:**

```
$ mcp-config init --with github,filesystem

  Created .mcp.json with 2 servers:
    github       — requires GITHUB_TOKEN (not set)
    filesystem   — ready

  Run `mcp-config doctor` to check for missing configuration.
```

**Default (no `--with`):**

```
$ mcp-config init

  Created .mcp.json with empty server list.

  Get started:
    mcp-config add github        Add GitHub MCP server
    mcp-config search database   Find database servers
    mcp-config add <name>        Add any registry server
```

### Command: `mcp-config doctor`

Runs a comprehensive diagnostic on the config file, checking everything: JSON syntax, schema, transport validity, command existence, npm package existence, env var presence, and optionally server reachability.

```
mcp-config doctor [options]

Options:
  --config <path>     Config file to diagnose. Default: .mcp.json
  --check-npm         Verify npm packages exist on registry
  --check-health      Attempt to connect to each server (requires mcp-healthcheck)
  --format <format>   Output format: human, json. Default: human
```

**Example:**

```
$ mcp-config doctor

  mcp-config doctor v0.1.0 — .mcp.json

  Checking 3 servers...

  github
    PASS  command 'npx' found in PATH
    PASS  package '@modelcontextprotocol/server-github' exists on npm
    PASS  GITHUB_TOKEN is set in environment
    PASS  Config structure valid

  filesystem
    PASS  command 'npx' found in PATH
    PASS  package '@modelcontextprotocol/server-filesystem' exists on npm
    PASS  Config structure valid
    WARN  Directory '/home/user/projects' — verify this path is correct

  brave-search
    PASS  command 'npx' found in PATH
    PASS  package '@modelcontextprotocol/server-brave-search' exists on npm
    FAIL  BRAVE_API_KEY is not set in environment
    TIP   Set it: export BRAVE_API_KEY=<your-api-key>
          Or add to .env: BRAVE_API_KEY=<your-api-key>

  ─────────────────────────────────────────────────────────
  3 servers checked: 2 healthy, 1 with issues
  Overall: WARN — 1 missing environment variable
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success. Command completed without errors. |
| `1` | Failure. Validation failed, server not found, or operation error. |
| `2` | Configuration/usage error. Invalid flags, missing required arguments, or unreadable config file. |

### Environment Variables

| Environment Variable | Equivalent Flag |
|---------------------|-----------------|
| `MCP_CONFIG_PATH` | `--config` |
| `MCP_CONFIG_FORMAT` | `--format` |

---

## 11. Environment Variable Management

### Detection of Required Env Vars

When adding a server from the registry, `mcp-config-ts` knows which env vars are required (from the registry entry's `requiredEnvVars` field). For servers not in the registry, the tool cannot infer required env vars.

### Interactive Prompting

When `mcp-config add <server>` is run interactively (stdin is a TTY) and the registry specifies required env vars, the CLI prompts the developer for each:

```
Required environment variables:
  GITHUB_TOKEN — Personal access token for GitHub API
                 Example: ghp_abc123def456

? GITHUB_TOKEN: █
```

For env vars marked `sensitive: true` in the registry, the input is masked (characters replaced with `*`). The entered value is never logged or displayed after entry.

### Shell Env Var Checking

During validation and `doctor`, the tool checks whether env vars referenced in the config are set in the current shell environment:

```typescript
const value = process.env[envVarName];
if (!value) {
  // Report warning: env var not set
}
```

This catches the common case where a developer has the env var in their `.env` file but not in their current shell session.

### .env File Integration

When checking env var presence, `mcp-config-ts` also checks for a `.env` file in the project root. If the env var is not in `process.env` but is defined in `.env`, the tool reports it as a warning (the env var is defined in `.env` but the developer may need to `source` it or use a `.env` loader).

`.env` file parsing is minimal: lines matching `KEY=VALUE` or `KEY="VALUE"` are recognized. Comment lines (starting with `#`) and empty lines are ignored. No `.env` expansion library is used -- the parser is a simple regex.

### Placeholder Detection

The validator detects placeholder values in env var fields:

| Pattern | Detected As |
|---|---|
| `<your-...>` | Placeholder |
| `<YOUR_...>` | Placeholder |
| `TODO` | Placeholder |
| `xxx` / `XXX` | Placeholder |
| `changeme` | Placeholder |
| `REPLACE_ME` | Placeholder |
| Empty string `""` | Placeholder |

Placeholder values are reported as warnings during validation.

### Secret Safety

`mcp-config-ts` follows strict rules about secret handling:

1. **Never log actual env var values.** Log messages and output always use `***` for sensitive values.
2. **Mask sensitive input.** When prompting for env vars marked `sensitive: true`, input is masked.
3. **Warn about secrets in config files.** If a config file contains what appears to be an actual secret (long alphanumeric strings in env var values), the `doctor` command warns that secrets should be stored in environment variables or a secrets manager, not in config files committed to version control.
4. **Respect .gitignore.** The `init` command checks if `.mcp.json` is in `.gitignore` and warns if it is not, since config files with inline secrets should not be committed.

---

## 12. Configuration

### Tool Configuration

`mcp-config-ts` itself has minimal configuration. It does not read a dedicated config file. All behavior is controlled via CLI flags, environment variables, and the `ManagerOptions` object for programmatic use.

### Default Config File Resolution

When no `--config` flag is provided, the CLI resolves the config file as follows:

1. If `.mcp.json` exists in the current directory, use it.
2. If no `.mcp.json` exists, check parent directories up to the filesystem root (like `.git` discovery). Stop at the first `.mcp.json` found.
3. If no `.mcp.json` is found anywhere, commands that read a config (`list`, `validate`, `doctor`) exit with code 2 and a message suggesting `mcp-config init`. Commands that create a config (`init`, `add`) create `.mcp.json` in the current directory.

### Default Values

| Option | Default | Description |
|--------|---------|-------------|
| Config path | `.mcp.json` (in cwd or nearest parent) | Which config file to operate on. |
| Validation level | `3` | Transport consistency checks by default. |
| Conflict strategy | `skip` | Do not overwrite existing servers during sync. |
| Output format | `human` | Human-readable terminal output. |
| Search limit | `20` | Maximum search results. |
| Check npm | `false` | Do not query npm for package existence by default. |
| Check env | `true` | Check shell environment for env vars by default. |

---

## 13. Integration

### Integration with mcp-healthcheck

`mcp-config-ts` optionally integrates with `mcp-healthcheck` for the `doctor --check-health` flag. When `mcp-healthcheck` is installed, `mcp-config doctor --check-health` loads each server's config, constructs a `HealthCheckOptions` object from the server entry, and calls `checkHealth()` to verify the server starts and responds to the MCP handshake. Results are displayed inline with the other doctor checks.

```bash
$ mcp-config doctor --check-health

  github
    PASS  config valid
    PASS  env vars set
    PASS  health check: healthy (234ms, 5 tools)

  filesystem
    PASS  config valid
    PASS  health check: healthy (89ms, 11 tools)

  broken-server
    PASS  config valid
    FAIL  health check: unhealthy — SPAWN_ERROR: command not found
```

If `mcp-healthcheck` is not installed, the `--check-health` flag prints a message suggesting installation and exits with code 2.

### Integration with mcp-schema-lint

`mcp-config-ts` does not directly integrate with `mcp-schema-lint`, but the two tools are complementary. A developer might run `mcp-config validate` to verify their config file is correct, then use `mcp-schema-lint` against a running server to verify its schema quality. The `doctor` command's `--check-health` flag covers the connectivity layer; schema quality is a separate concern.

### Integration with ai-env-init

`ai-env-init` generates `.mcp.json` files as part of its AI config bootstrapping. `mcp-config-ts` can be used after `ai-env-init` to add more servers, validate the generated config, or sync servers from global configs into the generated `.mcp.json`. The two tools do not depend on each other at the code level.

### npm Script Integration

```json
{
  "scripts": {
    "mcp:list": "mcp-config list",
    "mcp:validate": "mcp-config validate --level 5",
    "mcp:doctor": "mcp-config doctor --check-npm"
  }
}
```

### CI/CD: GitHub Actions

```yaml
name: Validate MCP Config
on: [push, pull_request]

jobs:
  validate-mcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Validate MCP config
        run: npx mcp-config-ts validate --level 3 --format json
```

---

## 14. Testing Strategy

### Unit Tests

Unit tests verify each module in isolation, using in-memory config objects and mocked filesystem access.

- **Config loading tests**: Verify that `loadConfig` correctly parses valid MCP config files, extracts `mcpServers`, preserves non-MCP keys in `_otherKeys`, infers transport types, and throws appropriate errors for missing files, invalid JSON, and malformed structure.
- **Config saving tests**: Verify that `saveConfig` writes correct JSON, preserves `_otherKeys`, formats with 2-space indentation, and creates parent directories.
- **Validation tests**: For each validation level (1-5), provide a config that fails at that level and verify the correct `ValidationCheck` is produced. Test edge cases: empty `mcpServers`, entry with both `command` and `url`, entry with neither, placeholder env var values, commands not in PATH.
- **Add/remove tests**: Verify that `addServer` adds the correct entry and rejects duplicates. Verify that `addServerFromRegistry` looks up the registry, applies env values, and inserts placeholders for missing required env vars. Verify that `removeServer` removes the entry and throws for non-existent servers.
- **Sync tests**: Test all three conflict strategies (`skip`, `overwrite`, `merge-env`) with configs that have overlapping and non-overlapping servers. Verify `SyncResult` counts are correct. Test dry-run mode returns correct results without modifying anything.
- **Registry tests**: Verify that the registry contains all documented servers. Verify that registry search matches by name, keywords, and description. Verify that search ranking puts exact matches first.
- **Discovery tests**: Mock npm registry responses and verify that `discoverServers` with `searchNpm: true` returns correctly parsed results.
- **Tool alias resolution tests**: Verify that aliases (`'claude-desktop'`, `'cursor'`, `'windsurf'`, `'cline'`) resolve to correct platform-specific paths on macOS, Linux, and Windows.
- **CLI parsing tests**: Verify argument parsing for each command. Verify error messages for invalid arguments. Verify environment variable fallback.
- **Output formatting tests**: Verify human-readable and JSON output for each command.
- **Env var management tests**: Verify placeholder detection patterns. Verify `.env` file parsing. Verify secret masking in output.

### Integration Tests

Integration tests operate on real temporary config files on disk.

- **Round-trip test**: Create a config with `init`, add servers with `add`, validate with `validate`, remove a server with `remove`, re-validate. Verify the file on disk matches expectations at each step.
- **Sync integration test**: Create two temp config files with overlapping and unique servers. Run `syncConfigs` with each conflict strategy. Verify the target file contains the expected servers.
- **Doctor integration test**: Create a config with a valid server (using `echo` as the command) and a server with a missing command. Run `doctor` and verify the correct pass/fail results.
- **Registry search integration test**: Search the built-in registry for known servers and verify results. If network is available, search npm and verify parseable results.
- **CLI integration test**: Invoke the CLI binary via `child_process.execFile` with various commands and arguments. Verify stdout output and exit codes.

### Edge Cases to Test

- Config file with trailing commas (invalid JSON -- verify clear error message).
- Config file with duplicate server keys (verify detection).
- Config file that is valid JSON but has `mcpServers` as an array (verify schema error).
- Empty config file (`{}`).
- Config file with `mcpServers: {}` (zero servers -- valid).
- Server entry with empty `command: ""`.
- Server entry with `args` containing non-string values.
- Sync where source and target are the same file.
- Sync where source does not exist.
- `add` to a config that does not exist yet (should create the file).
- `remove` the last server from a config (should leave `"mcpServers": {}`).
- Tool alias on an unsupported platform.
- Registry search with no matches.
- Registry search with special characters in query.
- Config file with Windows-style line endings (`\r\n`).
- Config file that is read-only (verify permission error message).

### Test Framework

Tests use Vitest, matching the project's existing configuration. Temporary files for integration tests are created in `os.tmpdir()` and cleaned up in `afterEach` hooks.

---

## 15. Performance

### Config File Operations

Config files are small JSON files, typically under 10 KB even for configs with 20+ servers. All operations (load, parse, validate, save) complete in under 10ms. There are no performance concerns for config file I/O.

### Registry Search

Built-in registry search is a linear scan of the registry array (currently ~20 entries). Even with 500 entries, this completes in under 1ms. No indexing is needed.

npm registry search requires a network request. The npm search API typically responds in 200-500ms. The CLI shows a spinner during the request. Search results are not cached between invocations (each `mcp-config search` makes a fresh request).

### Validation

Validation levels 1-3 are purely local and complete in under 5ms. Level 4 (npm package existence) requires one HTTP request per server entry that uses `npx`. For a config with 10 `npx`-based servers, this means 10 requests. Requests are made in parallel using `Promise.all` to minimize wall-clock time. Each request hits the npm registry endpoint (`https://registry.npmjs.org/<package>`) which typically responds in 100-300ms. Total validation time for Level 4 with 10 servers: approximately 300-500ms.

Level 5 (env var presence) adds negligible overhead -- it reads `process.env` which is a synchronous in-memory operation.

### Sync

Sync operations load two config files, compute the diff, and write the target. Total time is dominated by file I/O, which completes in under 5ms for local files.

---

## 16. Dependencies

### Runtime Dependencies

None.

The package has zero runtime dependencies. All functionality is implemented using Node.js built-in modules:

| Capability | Node.js Built-in |
|---|---|
| JSON parsing | `JSON.parse` / `JSON.stringify` |
| File I/O | `node:fs/promises` |
| CLI argument parsing | `node:util` (`parseArgs`) |
| Path resolution | `node:path` |
| HTTP requests (npm search, package check) | `node:https` (via `fetch` in Node.js 18+) |
| Home directory resolution | `node:os` (`homedir()`) |
| Platform detection | `node:os` (`platform()`) |
| Interactive prompts | `node:readline` |
| Environment variable access | `process.env` |
| Command existence check | `node:child_process` (`execSync('which <cmd>')` / `where <cmd>` on Windows) |

The decision to have zero runtime dependencies is intentional. MCP config management is a developer tool that runs infrequently and needs to be lightweight. CLI parsing with `util.parseArgs`, HTTP with global `fetch`, and prompts with `readline` avoid the 30+ transitive dependencies that a CLI framework like `commander` or a prompt library like `inquirer` would bring.

### Dev Dependencies

| Dependency | Purpose |
|---|---|
| `typescript` | TypeScript compiler. |
| `vitest` | Test runner. |
| `eslint` | Linter. |

---

## 17. File Structure

```
mcp-config-ts/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── src/
│   ├── index.ts                   # Public API exports
│   ├── cli.ts                     # CLI entry point: command routing, argument parsing
│   ├── types.ts                   # All TypeScript type definitions
│   ├── config/
│   │   ├── load.ts                # loadConfig(): read and parse config files
│   │   ├── save.ts                # saveConfig(): write config files with round-trip preservation
│   │   ├── resolve-path.ts        # Config path resolution: tool aliases, cwd search
│   │   └── parse.ts               # Parse mcpServers entries, infer transport types
│   ├── registry/
│   │   ├── registry.json          # Built-in server registry data
│   │   ├── registry.ts            # Registry lookup and search functions
│   │   └── npm-search.ts          # npm registry search integration
│   ├── validation/
│   │   ├── validate.ts            # validateConfig(): orchestrate all validation levels
│   │   ├── json-syntax.ts         # Level 1: JSON syntax check
│   │   ├── schema.ts              # Level 2: schema structure check
│   │   ├── transport.ts           # Level 3: transport consistency check
│   │   ├── command.ts             # Level 4: command and package existence
│   │   ├── env-vars.ts            # Level 5: environment variable presence
│   │   └── completeness.ts        # Completeness score calculation
│   ├── operations/
│   │   ├── add.ts                 # addServer(), addServerFromRegistry()
│   │   ├── remove.ts              # removeServer()
│   │   └── sync.ts                # syncConfigs()
│   ├── manager.ts                 # createManager(): stateful ConfigManager
│   ├── commands/
│   │   ├── list.ts                # CLI handler: mcp-config list
│   │   ├── add.ts                 # CLI handler: mcp-config add
│   │   ├── remove.ts              # CLI handler: mcp-config remove
│   │   ├── validate.ts            # CLI handler: mcp-config validate
│   │   ├── sync.ts                # CLI handler: mcp-config sync
│   │   ├── search.ts              # CLI handler: mcp-config search
│   │   ├── init.ts                # CLI handler: mcp-config init
│   │   └── doctor.ts              # CLI handler: mcp-config doctor
│   ├── formatters/
│   │   ├── human.ts               # Human-readable terminal output
│   │   └── json.ts                # JSON output
│   ├── utils/
│   │   ├── env.ts                 # .env file parsing, env var checking
│   │   ├── prompt.ts              # Interactive prompting (readline wrapper)
│   │   ├── command-exists.ts      # Check if a command is in PATH
│   │   └── errors.ts              # Custom error classes
│   └── __tests__/
│       ├── config/
│       │   ├── load.test.ts
│       │   ├── save.test.ts
│       │   └── resolve-path.test.ts
│       ├── registry/
│       │   ├── registry.test.ts
│       │   └── npm-search.test.ts
│       ├── validation/
│       │   ├── validate.test.ts
│       │   ├── json-syntax.test.ts
│       │   ├── schema.test.ts
│       │   ├── transport.test.ts
│       │   ├── command.test.ts
│       │   └── env-vars.test.ts
│       ├── operations/
│       │   ├── add.test.ts
│       │   ├── remove.test.ts
│       │   └── sync.test.ts
│       ├── manager.test.ts
│       ├── cli.test.ts
│       ├── integration.test.ts
│       └── fixtures/
│           ├── valid-config.json
│           ├── invalid-json.txt
│           ├── missing-mcpservers.json
│           ├── mixed-transport.json
│           ├── placeholder-env.json
│           ├── claude-desktop-config.json
│           └── .env.test
└── dist/                           # Compiled output (gitignored)
```

---

## 18. Implementation Roadmap

### Phase 1: Core Config Operations (v0.1.0)

Implement config loading, saving, basic validation, and add/remove operations.

**Deliverables:**
- `loadConfig()` and `saveConfig()` with round-trip preservation.
- `addServer()` and `removeServer()`.
- Validation levels 1-3 (JSON syntax, schema structure, transport consistency).
- CLI commands: `init`, `list`, `add` (manual mode only), `remove`, `validate`.
- Type definitions for all public interfaces.
- Unit tests for config loading, saving, validation, and add/remove.
- Human-readable and JSON output formatters.

### Phase 2: Server Registry and Discovery (v0.2.0)

Add the built-in server registry and search capabilities.

**Deliverables:**
- Built-in registry with config templates for 15+ popular MCP servers.
- `addServerFromRegistry()` with interactive env var prompting.
- `discoverServers()` with built-in registry search.
- CLI commands: `search`, `add` (registry mode).
- npm registry search integration (`search --npm`).
- Unit tests for registry lookup, search ranking, and npm search parsing.

### Phase 3: Syncing and Doctor (v0.3.0)

Add config syncing between files and the comprehensive doctor command.

**Deliverables:**
- `syncConfigs()` with all three conflict strategies.
- Tool alias resolution for all supported tools (Claude Desktop, Cursor, Windsurf, Cline).
- `doctor` command with Level 4-5 validation (command existence, npm package check, env var presence).
- `list --all` to show servers across all config locations.
- Dry-run mode for sync.
- `.env` file integration for env var checking.
- Integration tests for sync and doctor.

### Phase 4: Polish and Ecosystem Integration (v1.0.0)

Stabilize the API, add integration with `mcp-healthcheck`, complete documentation.

**Deliverables:**
- API stability guarantee (semver major version).
- `doctor --check-health` integration with `mcp-healthcheck`.
- Comprehensive README with usage examples and command reference.
- CI/CD integration examples (GitHub Actions).
- Edge case handling for all identified edge cases.
- Performance optimization for Level 4 validation (parallel npm requests).
- Published npm package with TypeScript declarations and CLI binary.

---

## 19. Example Use Cases

### 19.1 Setting Up MCP for a New Project

A developer starts a new project and wants to configure MCP servers for GitHub, filesystem access, and memory.

```bash
$ cd ~/projects/new-app

$ mcp-config init
  Created .mcp.json with empty server list.

$ mcp-config add github
  Adding server: github
  Package: @modelcontextprotocol/server-github

  Required environment variables:
    GITHUB_TOKEN — Personal access token for GitHub API
  ? GITHUB_TOKEN: ghp_abc123def456

  Added 'github' to .mcp.json

$ mcp-config add filesystem
  Adding server: filesystem
  Package: @modelcontextprotocol/server-filesystem

  ? Directories to allow access to: /home/user/projects/new-app
  Added 'filesystem' to .mcp.json

$ mcp-config add memory
  Adding server: memory
  Package: @modelcontextprotocol/server-memory
  No environment variables required.
  Added 'memory' to .mcp.json

$ mcp-config list

  .mcp.json — 3 servers

  github       stdio    npx -y @modelcontextprotocol/server-github
  filesystem   stdio    npx -y @modelcontextprotocol/server-filesystem /home/user/projects/new-app
  memory       stdio    npx -y @modelcontextprotocol/server-memory

$ mcp-config validate
  7 passed, 0 failed, 0 warnings
  Completeness: 100/100
```

### 19.2 Team MCP Standardization

A tech lead wants to ensure all team members use the same MCP servers with consistent configuration.

```bash
# Tech lead creates the canonical config
$ mcp-config init --with github,postgres,memory
  Created .mcp.json with 3 servers

# Commit to repo
$ git add .mcp.json
$ git commit -m "chore: add MCP server configuration"

# Add CI validation
# .github/workflows/validate-mcp.yml:
#   - run: npx mcp-config-ts validate --level 3
```

New team member onboarding:

```bash
$ git clone <repo>
$ cd repo

# Check that everything is configured correctly
$ npx mcp-config-ts doctor

  github
    PASS  command 'npx' found in PATH
    FAIL  GITHUB_TOKEN is not set in environment
    TIP   Set it: export GITHUB_TOKEN=<your-token>

  postgres
    PASS  command 'npx' found in PATH
    FAIL  POSTGRES_URL is not set in environment
    TIP   Set it: export POSTGRES_URL=postgresql://user:pass@localhost/db

  memory
    PASS  command 'npx' found in PATH
    PASS  No env vars required

  2 of 3 servers have issues. Set the missing environment variables.
```

### 19.3 Migrating Configs Between Tools

A developer switches from Cursor to Claude Code and wants to bring their MCP configs along.

```bash
$ mcp-config list --config cursor

  ~/.cursor/mcp.json — 4 servers

  github       stdio    npx -y @modelcontextprotocol/server-github
  postgres     stdio    npx -y @modelcontextprotocol/server-postgres
  puppeteer    stdio    npx -y @modelcontextprotocol/server-puppeteer
  slack        stdio    npx -y @modelcontextprotocol/server-slack

$ mcp-config sync cursor .mcp.json --dry-run

  Sync: ~/.cursor/mcp.json → .mcp.json

  + github       (add)
  + postgres     (add)
  + puppeteer    (add)
  + slack        (add)

  Summary: 4 to add, 0 to update, 0 to skip

$ mcp-config sync cursor .mcp.json

  Synced 4 servers from ~/.cursor/mcp.json to .mcp.json
```

### 19.4 Diagnosing a Broken MCP Server

A developer's MCP server is not connecting and they need to figure out why.

```bash
$ mcp-config doctor --check-npm

  custom-api
    PASS  config structure valid
    PASS  command 'npx' found in PATH
    FAIL  package 'mcp-servr-custom-api' does not exist on npm
    TIP   Did you mean 'mcp-server-custom-api'? Check the package name.
    FAIL  API_KEY has placeholder value '<your-api-key>'
    TIP   Set it to your actual API key.

  1 server checked: 0 healthy, 1 with issues
```

### 19.5 Programmatic Config Management in a Scaffolding Tool

A project generator creates new repositories and wants to set up MCP config automatically.

```typescript
import { createManager } from 'mcp-config-ts';

async function setupMcpConfig(projectDir: string, options: { githubToken: string }) {
  const manager = createManager({
    configPath: `${projectDir}/.mcp.json`,
  });

  // Create new config
  await manager.load().catch(() => {
    // File doesn't exist yet, that's fine
  });

  // Add standard servers
  manager.addFromRegistry('github', {
    GITHUB_TOKEN: options.githubToken,
  });

  manager.addFromRegistry('filesystem');
  manager.addFromRegistry('memory');

  // Validate before saving
  const result = await manager.validate({ level: 3 });
  if (!result.valid) {
    throw new Error(`MCP config validation failed: ${result.checks.filter(c => !c.passed).map(c => c.message).join(', ')}`);
  }

  await manager.save();
}
```

### 19.6 Bulk Syncing Across Multiple Projects

A developer wants to add a new MCP server to all their projects at once.

```bash
# Add to global config first
$ mcp-config add brave-search --config claude-desktop
  Added 'brave-search' to ~/.claude/claude_desktop_config.json

# Sync to each project
$ for dir in ~/projects/app1 ~/projects/app2 ~/projects/app3; do
    echo "Syncing to $dir..."
    mcp-config sync claude-desktop "$dir/.mcp.json" --servers brave-search
  done

  Syncing to ~/projects/app1...
  Added 'brave-search' to ~/projects/app1/.mcp.json

  Syncing to ~/projects/app2...
  Added 'brave-search' to ~/projects/app2/.mcp.json

  Syncing to ~/projects/app3...
  Added 'brave-search' to ~/projects/app3/.mcp.json
```
