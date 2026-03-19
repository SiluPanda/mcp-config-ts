# mcp-config-ts — Task Breakdown

This file tracks all implementation tasks derived from [SPEC.md](./SPEC.md). Tasks are grouped by phase and module, following the implementation roadmap in the spec (Sections 17-18).

---

## Phase 0: Project Scaffolding and Setup

- [ ] **Install dev dependencies** — Add `typescript`, `vitest`, and `eslint` as dev dependencies. Configure eslint for TypeScript. | Status: not_done
- [ ] **Add CLI bin entry to package.json** — Add `"bin": { "mcp-config": "./dist/cli.js" }` to package.json so the CLI is available as `mcp-config` when installed globally or via npx. | Status: not_done
- [ ] **Create directory structure** — Create all directories specified in Section 17: `src/config/`, `src/registry/`, `src/validation/`, `src/operations/`, `src/commands/`, `src/formatters/`, `src/utils/`, `src/__tests__/` (with subdirectories `config/`, `registry/`, `validation/`, `operations/`, `fixtures/`). | Status: not_done
- [ ] **Create types.ts with all type definitions** — Define all TypeScript interfaces and types from Section 9: `MCPConfig`, `StdioServerEntry`, `HttpServerEntry`, `ServerEntry`, `ValidationResult`, `ValidationCheck`, `SyncOptions`, `SyncResult`, `ServerInfo`, `ManagerOptions`, `ConfigManager`, `RegistryEntry`, `DiscoverOptions`. | Status: not_done
- [ ] **Create custom error classes in utils/errors.ts** — Implement `MCPConfigError`, `ConfigNotFoundError`, `ConfigParseError`, `ServerExistsError`, `ServerNotFoundError`, `ValidationError` as specified in Section 9 (Error Types). Each error class must have its `code` property and any additional fields (e.g., `configPath`, `serverName`, `parseError`, `result`). | Status: not_done
- [ ] **Create test fixtures** — Create all fixture files listed in Section 17: `valid-config.json`, `invalid-json.txt`, `missing-mcpservers.json`, `mixed-transport.json`, `placeholder-env.json`, `claude-desktop-config.json`, `.env.test`. Each fixture should represent the scenario its name describes. | Status: not_done

---

## Phase 1: Core Config Operations (v0.1.0)

### Config Loading (`src/config/load.ts`)

- [ ] **Implement loadConfig() — basic file reading** — Read a JSON file from the given path, parse it, extract the `mcpServers` key, and return an `MCPConfig` object. Default to `.mcp.json` in cwd if no path is provided. | Status: not_done
- [ ] **Implement loadConfig() — transport type inference** — For each entry in `mcpServers`, infer the transport type: if the entry has a `command` field, set `type: 'stdio'`; if it has a `url` field, set `type: 'http'`. | Status: not_done
- [ ] **Implement loadConfig() — round-trip key preservation** — When parsing the config file, store all non-`mcpServers` keys in `_otherKeys` on the `MCPConfig` object so they can be preserved when saving. | Status: not_done
- [ ] **Implement loadConfig() — tool alias resolution** — If the `path` argument is a tool alias (`'claude-desktop'`, `'cursor'`, `'windsurf'`, `'cline'`), resolve it to the platform-specific path before reading. Delegate to `resolve-path.ts`. | Status: not_done
- [ ] **Implement loadConfig() — error handling** — Throw `ConfigNotFoundError` if the file does not exist. Throw `ConfigParseError` if the file is not valid JSON. Include the file path and original error in the thrown error. | Status: not_done

### Config Path Resolution (`src/config/resolve-path.ts`)

- [ ] **Implement tool alias resolution** — Map tool aliases to platform-specific paths: `claude-desktop` to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `~/.config/claude/claude_desktop_config.json` (Linux), `%APPDATA%\Claude\claude_desktop_config.json` (Windows). Similarly for `cursor`, `windsurf`, and `cline` per the table in Section 8. | Status: not_done
- [ ] **Implement default config file discovery** — When no path is specified: (1) check for `.mcp.json` in cwd, (2) walk parent directories up to filesystem root looking for `.mcp.json`, (3) return `null` or throw if not found. Per Section 12 (Default Config File Resolution). | Status: not_done
- [ ] **Implement MCP_CONFIG_PATH environment variable fallback** — If the `MCP_CONFIG_PATH` environment variable is set, use it as the default config path (overrides the cwd/.mcp.json default). Per Section 10 (Environment Variables). | Status: not_done

### Config Parsing (`src/config/parse.ts`)

- [ ] **Implement parseServerEntries()** — Parse raw JSON objects from `mcpServers` into typed `ServerEntry` objects. Infer transport type from field presence (`command` => stdio, `url` => http). Handle entries with both or neither field gracefully (mark as invalid for later validation). | Status: not_done

### Config Saving (`src/config/save.ts`)

- [ ] **Implement saveConfig() — basic writing** — Write an `MCPConfig` object to a JSON file. Merge `servers` back into the `mcpServers` key. Format with 2-space indentation. Strip the `type` field from server entries before writing (it is inferred, not stored on disk). | Status: not_done
- [ ] **Implement saveConfig() — round-trip preservation** — When writing, merge `_otherKeys` back into the top-level JSON object so non-MCP settings (e.g., `theme` in Claude Desktop config) are preserved. | Status: not_done
- [ ] **Implement saveConfig() — parent directory creation** — If the target path's parent directories do not exist, create them recursively using `fs.mkdir({ recursive: true })`. | Status: not_done
- [ ] **Implement saveConfig() — path default and alias support** — If no path is provided, write to `config.filePath`. Support tool aliases by resolving them before writing. | Status: not_done

### Validation Level 1: JSON Syntax (`src/validation/json-syntax.ts`)

- [ ] **Implement JSON syntax validation** — Check if the file content is valid JSON. Return a `ValidationCheck` with `id: 'json-syntax'`, `severity: 'error'`, `passed: true/false`, and a descriptive message. Handle empty files, trailing commas, unquoted keys, and other common JSON errors with clear error messages. | Status: not_done

### Validation Level 2: Schema Structure (`src/validation/schema.ts`)

- [ ] **Check mcpServers key presence** — Verify the parsed JSON has a top-level `mcpServers` key. Return `ValidationCheck` with `id: 'schema-mcpservers-present'`. | Status: not_done
- [ ] **Check mcpServers type** — Verify `mcpServers` is an object (not array, string, null, etc.). | Status: not_done
- [ ] **Check server entry required fields** — For each server entry, verify it has at least `command` (stdio) or `url` (http). Report missing required fields. | Status: not_done
- [ ] **Check field types** — Verify `command` is a string, `args` is a string array, `env` is an object of string values, `url` is a string. Report type mismatches. | Status: not_done
- [ ] **Detect unknown fields** — Warn about unknown fields in server entries that might indicate typos (e.g., `cmd` instead of `command`, `arguments` instead of `args`). | Status: not_done

### Validation Level 3: Transport Consistency (`src/validation/transport.ts`)

- [ ] **Detect mixed transport** — Flag server entries that have both `command` and `url` as errors (ambiguous transport type). | Status: not_done
- [ ] **Validate stdio entry fields** — For stdio entries: verify `command` is a non-empty string, `args` is an array of strings (not numbers or objects). | Status: not_done
- [ ] **Validate HTTP entry fields** — For HTTP entries: verify `url` is a syntactically valid URL with `http://` or `https://` scheme. | Status: not_done

### Validation Orchestrator (`src/validation/validate.ts`)

- [ ] **Implement validateConfig()** — Orchestrate validation by running checks for levels 1 through the requested `level` (default 3). Collect all `ValidationCheck` results, compute the summary (total, passed, failed, warnings), and return a `ValidationResult`. Accept options `level`, `checkNpm`, `checkEnv`. | Status: not_done

### Completeness Score (`src/validation/completeness.ts`)

- [ ] **Implement completeness score calculation** — Start at 100 points. Deduct 30 per schema structure error, 20 per transport consistency error, 10 per missing command, 10 per missing required env var, 5 per warning. Floor at 0. Per Section 7 (Completeness Score). | Status: not_done

### Duplicate Server Name Detection

- [ ] **Implement duplicate key detection** — Before JSON parsing, perform a raw text scan of the config file for duplicate keys under `mcpServers`. JSON.parse silently uses the last value for duplicate keys; this check catches the mistake. Include in Level 2 validation. | Status: not_done

### Add Server (`src/operations/add.ts`)

- [ ] **Implement addServer()** — Accept an `MCPConfig`, a server name, and a `ServerEntry`. Return a new `MCPConfig` with the server added. Throw `ServerExistsError` if the server name already exists. Do not mutate the input. | Status: not_done

### Remove Server (`src/operations/remove.ts`)

- [ ] **Implement removeServer()** — Accept an `MCPConfig` and a server name. Return a new `MCPConfig` with the server removed. Throw `ServerNotFoundError` if the server does not exist. Do not mutate the input. | Status: not_done

### Output Formatters

- [ ] **Implement human-readable formatter (`src/formatters/human.ts`)** — Format output for terminal display. Include functions for formatting: server lists, validation results, sync results, search results, and doctor output. Match the exact output formats shown in Section 10 CLI examples. | Status: not_done
- [ ] **Implement JSON formatter (`src/formatters/json.ts`)** — Format all output as structured JSON for machine consumption. Each command's output should be a well-defined JSON object. | Status: not_done

### CLI Entry Point (`src/cli.ts`)

- [ ] **Implement CLI argument parsing** — Use `node:util` `parseArgs` to parse CLI arguments. Parse the command (first positional arg) and route to the appropriate command handler. Support global options: `--config`, `--format`, `--quiet`, `--version`, `--help`. | Status: not_done
- [ ] **Add shebang line** — Add `#!/usr/bin/env node` at the top of `cli.ts` so it can be executed directly. | Status: not_done
- [ ] **Implement --version flag** — Read version from package.json and print it. | Status: not_done
- [ ] **Implement --help flag** — Print the usage text showing all commands and global options as specified in Section 10. | Status: not_done
- [ ] **Implement exit codes** — Exit with code 0 on success, 1 on failure (validation failed, server not found, operation error), 2 on configuration/usage error (invalid flags, missing required arguments, unreadable config file). Per Section 10 (Exit Codes). | Status: not_done
- [ ] **Implement MCP_CONFIG_FORMAT environment variable** — If `MCP_CONFIG_FORMAT` is set, use it as the default output format. CLI `--format` flag overrides it. | Status: not_done

### CLI Command: `init` (`src/commands/init.ts`)

- [ ] **Implement init command — basic** — Create a new `.mcp.json` file with `{ "mcpServers": {} }` in the current directory (or path specified by `--config`). If file already exists, prompt for confirmation unless `--force` is passed. | Status: not_done
- [ ] **Implement init command — with servers** — Support `--with <servers>` flag to include registry servers in the initial config. For each server, look up the registry template and add it. Report which servers need env vars configured. | Status: not_done
- [ ] **Implement init command — .gitignore check** — After creating `.mcp.json`, check if it is listed in `.gitignore`. Warn if it is not, since config files with inline secrets should not be committed. Per Section 11 (Secret Safety). | Status: not_done

### CLI Command: `list` (`src/commands/list.ts`)

- [ ] **Implement list command — single config** — Load the config and display all servers with their transport type, command/url, args, and env var names. Use the human formatter by default. Support `--format json`. | Status: not_done
- [ ] **Implement list command — --all flag** — When `--all` is passed, scan all known config locations (project `.mcp.json`, Claude Desktop, Cursor, Windsurf, Cline) and display servers from each file. Report files that do not exist as "not found". | Status: not_done

### CLI Command: `add` (`src/commands/add.ts`)

- [ ] **Implement add command — manual mode** — Support adding a custom server with `--command`, `--args`, `--url`, `--env` flags. Create the server entry from the provided flags. | Status: not_done
- [ ] **Implement add command — --name flag** — Support `--name` flag to override the server name (default: use the positional argument). | Status: not_done
- [ ] **Implement add command — create file if missing** — If the target config file does not exist, create it with `{ "mcpServers": {} }` before adding the server. | Status: not_done

### CLI Command: `remove` (`src/commands/remove.ts`)

- [ ] **Implement remove command** — Load the config, remove the specified server, save the config. Prompt for confirmation unless `--force` is passed. Display a success message. | Status: not_done

### CLI Command: `validate` (`src/commands/validate.ts`)

- [ ] **Implement validate command** — Load the config, run `validateConfig()` with the specified `--level`, and display the results. Support `--check-npm` and `--check-env` flags. Support `--format json`. Exit with code 1 if validation fails. | Status: not_done

### Public API Exports (`src/index.ts`)

- [ ] **Export all public API functions** — Export `loadConfig`, `saveConfig`, `validateConfig`, `addServer`, `removeServer`, `syncConfigs`, `discoverServers`, `createManager`, `addServerFromRegistry`. Export all public types. Export error classes. Per Section 9 (Main Exports). | Status: not_done

### Phase 1 Tests

- [ ] **Write config load tests (`src/__tests__/config/load.test.ts`)** — Test: loading a valid config, transport type inference, round-trip key preservation, tool alias resolution, ConfigNotFoundError for missing files, ConfigParseError for invalid JSON, handling of empty files. | Status: not_done
- [ ] **Write config save tests (`src/__tests__/config/save.test.ts`)** — Test: writing valid config, round-trip preservation of non-MCP keys, 2-space indentation, parent directory creation, stripping `type` field from entries. | Status: not_done
- [ ] **Write config resolve-path tests (`src/__tests__/config/resolve-path.test.ts`)** — Test: all four tool alias resolutions on macOS/Linux/Windows, default cwd `.mcp.json` discovery, parent directory walk, `MCP_CONFIG_PATH` env var. | Status: not_done
- [ ] **Write JSON syntax validation tests (`src/__tests__/validation/json-syntax.test.ts`)** — Test: valid JSON passes, empty file fails, trailing commas fail, unquoted keys fail, clear error messages for each case. | Status: not_done
- [ ] **Write schema validation tests (`src/__tests__/validation/schema.test.ts`)** — Test: missing `mcpServers` key, `mcpServers` as array, server entry with no `command` or `url`, field type mismatches, unknown field detection. | Status: not_done
- [ ] **Write transport validation tests (`src/__tests__/validation/transport.test.ts`)** — Test: entry with both `command` and `url`, empty `command` string, `args` with non-string values, invalid URL scheme, URL syntax validation. | Status: not_done
- [ ] **Write validate orchestrator tests (`src/__tests__/validation/validate.test.ts`)** — Test: running levels 1-3, summary counts, completeness score, correct check ordering. | Status: not_done
- [ ] **Write add operation tests (`src/__tests__/operations/add.test.ts`)** — Test: adding a server, rejecting duplicates (ServerExistsError), immutability (original config unchanged). | Status: not_done
- [ ] **Write remove operation tests (`src/__tests__/operations/remove.test.ts`)** — Test: removing a server, rejecting non-existent servers (ServerNotFoundError), removing last server leaves `{}`, immutability. | Status: not_done

---

## Phase 2: Server Registry and Discovery (v0.2.0)

### Registry Data (`src/registry/registry.json`)

- [ ] **Create registry.json with all built-in entries** — Create the JSON file with entries for all 17 servers listed in Section 6: filesystem, github, gitlab, slack, postgres, sqlite, brave-search, puppeteer, memory, sequential-thinking, everything, fetch, google-maps, sentry, cloudflare, linear, notion. Each entry must include: `name`, `description`, `npmPackage`, `category`, `config` (command, args, env), `requiredEnvVars` (with name, description, example, sensitive), `optionalEnvVars`, `keywords`, `homepage`. | Status: not_done

### Registry Lookup and Search (`src/registry/registry.ts`)

- [ ] **Implement registry loading** — Load and parse `registry.json`. Provide a function `getRegistryEntry(name: string): RegistryEntry | undefined` for exact name lookup. | Status: not_done
- [ ] **Implement registry search** — Provide a function `searchRegistry(query: string): RegistryEntry[]` that matches against `name`, `description`, `keywords`, and `npmPackage`. Implement ranking: exact name match scores highest, then keyword match, then description match. Return results sorted by relevance. | Status: not_done
- [ ] **Implement getAllRegistryEntries()** — Return all entries for listing/browsing. | Status: not_done

### npm Registry Search (`src/registry/npm-search.ts`)

- [ ] **Implement npm search** — Query the npm registry search API (`https://registry.npmjs.org/-/v1/search?text=mcp+server+<query>`) and parse results. Filter results to packages that appear to be MCP servers based on name patterns (`@modelcontextprotocol/server-*`, `mcp-server-*`, `*-mcp-server`). Return `ServerInfo[]` with `source: 'npm'`. | Status: not_done
- [ ] **Handle npm search errors** — Handle network errors, timeouts, and non-200 responses gracefully. Return empty results with a warning rather than throwing. | Status: not_done

### Add from Registry (`src/operations/add.ts` extension)

- [ ] **Implement addServerFromRegistry()** — Look up the registry entry by name. Apply the config template. Merge provided `envValues` into the `env` field. For required env vars not provided, insert placeholder values (e.g., `"<your-github-token>"`). Throw `ServerNotFoundError` if the registry name is not found. | Status: not_done

### Discovery API

- [ ] **Implement discoverServers()** — Search the built-in registry, and optionally (`searchNpm: true`) the npm registry. Combine results into a unified `ServerInfo[]` list. Support `limit` option. Per Section 9 (`discoverServers`). | Status: not_done

### Interactive Prompting (`src/utils/prompt.ts`)

- [ ] **Implement readline-based prompting** — Create a `prompt(question: string, options?: { mask?: boolean }): Promise<string>` function using `node:readline`. When `mask` is true, replace input characters with `*` for sensitive values. Only prompt when stdin is a TTY. | Status: not_done

### CLI Command: `add` — Registry Mode (`src/commands/add.ts` extension)

- [ ] **Implement add command — registry lookup** — When the server argument matches a registry entry, use the registry template instead of requiring manual flags. Display the package name and description. | Status: not_done
- [ ] **Implement add command — interactive env var prompting** — When running interactively (stdin is TTY) and the registry specifies required env vars, prompt the user for each value. Show the env var name, description, and example. Mask input for sensitive env vars. Support `--no-prompt` to skip prompting and use placeholders. | Status: not_done

### CLI Command: `search` (`src/commands/search.ts`)

- [ ] **Implement search command — registry search** — Search the built-in registry and display results with name, description, npm package, and required env vars. | Status: not_done
- [ ] **Implement search command — npm search** — When `--npm` flag is passed, also query the npm registry and display results with package name, description, version, and weekly downloads. Support `--limit` flag. | Status: not_done

### Phase 2 Tests

- [ ] **Write registry tests (`src/__tests__/registry/registry.test.ts`)** — Test: all documented servers are present, exact name lookup works, search matches by name/keywords/description, search ranking (exact match first), search with no matches returns empty array, search with special characters. | Status: not_done
- [ ] **Write npm search tests (`src/__tests__/registry/npm-search.test.ts`)** — Test: mock npm API response parsing, filtering to MCP server packages, handling of network errors, handling of non-200 responses, empty results. | Status: not_done
- [ ] **Write addServerFromRegistry tests (extend `src/__tests__/operations/add.test.ts`)** — Test: adding from registry with env values, adding with missing env values (placeholders inserted), ServerNotFoundError for unknown registry names, immutability. | Status: not_done

---

## Phase 3: Syncing and Doctor (v0.3.0)

### Sync Operation (`src/operations/sync.ts`)

- [ ] **Implement syncConfigs() — core logic** — Load source and target configs. Iterate over source servers. Apply the configured conflict strategy for each server. Return a `SyncResult` with added, updated, skipped, and error lists. | Status: not_done
- [ ] **Implement conflict strategy: skip** — If the target already has a server with the same name, skip it. Only add servers that are new to the target. | Status: not_done
- [ ] **Implement conflict strategy: overwrite** — Replace the target's entry with the source's entry entirely. | Status: not_done
- [ ] **Implement conflict strategy: merge-env** — Keep the target's entry but add any env vars from the source that the target is missing. Keep the target's existing env var values unchanged. | Status: not_done
- [ ] **Implement sync — server filtering** — Support the `servers` option to sync only specific named servers from the source (default: all). | Status: not_done
- [ ] **Implement sync — dry run mode** — When `dryRun` is true, compute the `SyncResult` without modifying the target file. Set `changed: false`. | Status: not_done
- [ ] **Implement sync — tool alias support** — Support tool aliases as source and target arguments. Resolve them to paths before loading. | Status: not_done
- [ ] **Implement sync — error handling** — Handle cases: source file does not exist, target file does not exist (create it), source and target are the same file (error or no-op). | Status: not_done

### Validation Level 4: Command and Package Existence (`src/validation/command.ts`)

- [ ] **Implement command existence check** — For each stdio server entry, check if the `command` executable is available in PATH using `child_process.execSync('which <cmd>')` (or `where <cmd>` on Windows). Return a `ValidationCheck` per server. | Status: not_done
- [ ] **Implement npm package existence check** — For stdio entries using `npx`, extract the npm package name from `args` and verify it exists on the npm registry by hitting `https://registry.npmjs.org/<package>`. Make requests in parallel with `Promise.all`. Only run when `checkNpm` option is true. | Status: not_done

### Command Existence Utility (`src/utils/command-exists.ts`)

- [ ] **Implement commandExists()** — Check if a given command is available in PATH. Use `which` on Unix, `where` on Windows. Return boolean. Handle errors gracefully (command not found = false). | Status: not_done

### Validation Level 5: Environment Variable Presence (`src/validation/env-vars.ts`)

- [ ] **Implement env var presence check** — For each server, look up required env vars from the registry. Check if they are present in the config's `env` field and in `process.env`. Return `ValidationCheck` results. | Status: not_done
- [ ] **Implement placeholder detection** — Detect placeholder values in env var fields: `<your-...>`, `<YOUR_...>`, `TODO`, `xxx`, `XXX`, `changeme`, `REPLACE_ME`, empty string `""`. Report as warnings. Per Section 11 (Placeholder Detection). | Status: not_done
- [ ] **Implement shell variable reference detection** — Detect `${VAR_NAME}` patterns in env var values. Warn when the referenced shell variable is not set in `process.env`. | Status: not_done

### Environment Variable Utilities (`src/utils/env.ts`)

- [ ] **Implement .env file parsing** — Parse a `.env` file using a simple regex: lines matching `KEY=VALUE` or `KEY="VALUE"`. Ignore comment lines (starting with `#`) and empty lines. No third-party `.env` library. | Status: not_done
- [ ] **Implement .env integration in validation** — During env var checking, also look for a `.env` file in the project root. If an env var is not in `process.env` but is defined in `.env`, report a specific warning that the var is defined in `.env` but may need to be sourced. | Status: not_done

### CLI Command: `sync` (`src/commands/sync.ts`)

- [ ] **Implement sync command** — Parse source and target arguments (positional). Support `--strategy`, `--servers`, `--dry-run`, `--format` flags. Call `syncConfigs()` and display results. Show human-readable diff for dry run. | Status: not_done

### CLI Command: `doctor` (`src/commands/doctor.ts`)

- [ ] **Implement doctor command — comprehensive diagnostics** — Run all validation levels (1-5) on the config. For each server, display per-check pass/fail results with tips for fixing failures. Support `--check-npm` flag for package existence checks. Support `--format json`. | Status: not_done
- [ ] **Implement doctor command — per-server output** — Group checks by server name. Show pass/fail/warn for each check. Include actionable tips (e.g., `Set it: export BRAVE_API_KEY=<your-api-key>`). | Status: not_done
- [ ] **Implement doctor command — summary** — Show overall summary: N servers checked, M healthy, K with issues. | Status: not_done

### CLI Command: `list --all` (extend `src/commands/list.ts`)

- [ ] **Implement list --all** — When `--all` is passed, iterate over all known config locations. For each, attempt to load and display servers. Report missing files as "not found". Group output by config file. | Status: not_done

### Secret Safety

- [ ] **Implement secret masking in output** — Never log or display actual env var values in any output. Use `***` for sensitive values. Per Section 11 (Secret Safety). | Status: not_done
- [ ] **Implement secret detection in doctor** — In the doctor command, warn when config files contain what appears to be actual secrets (long alphanumeric strings in env var values). Suggest using environment variables or a secrets manager instead. | Status: not_done

### Phase 3 Tests

- [ ] **Write sync tests (`src/__tests__/operations/sync.test.ts`)** — Test all three conflict strategies with overlapping and non-overlapping servers. Test dry-run mode. Test server filtering. Test SyncResult counts. Test same-source-and-target error. Test source-not-found error. Test creating target if it does not exist. | Status: not_done
- [ ] **Write command existence validation tests (`src/__tests__/validation/command.test.ts`)** — Test: command found in PATH, command not found, npm package existence (mock HTTP), npm package not found (mock HTTP), parallel request execution. | Status: not_done
- [ ] **Write env var validation tests (`src/__tests__/validation/env-vars.test.ts`)** — Test: env var present in config and process.env, env var missing from process.env, placeholder detection for all patterns, shell variable reference detection, .env file integration. | Status: not_done
- [ ] **Write env utility tests** — Test `.env` file parsing: basic KEY=VALUE, quoted values, comments, empty lines, malformed lines. | Status: not_done

---

## Phase 4: ConfigManager, Polish, and Ecosystem Integration (v1.0.0)

### ConfigManager (`src/manager.ts`)

- [ ] **Implement createManager()** — Create and return a `ConfigManager` instance. Accept `ManagerOptions` (configPath, validationLevel). | Status: not_done
- [ ] **Implement ConfigManager.load()** — Load the config from disk using `loadConfig()`. Store internally. | Status: not_done
- [ ] **Implement ConfigManager.save()** — Save the current config to disk using `saveConfig()`. | Status: not_done
- [ ] **Implement ConfigManager.getConfig()** — Return the current `MCPConfig`. Throw if not loaded. | Status: not_done
- [ ] **Implement ConfigManager.list()** — Return all server names from the current config. | Status: not_done
- [ ] **Implement ConfigManager.get()** — Return a specific server entry by name, or `undefined`. | Status: not_done
- [ ] **Implement ConfigManager.add()** — Add a server. Delegate to `addServer()`. Throw `ServerExistsError` if it already exists. | Status: not_done
- [ ] **Implement ConfigManager.addFromRegistry()** — Add a server from the registry. Delegate to `addServerFromRegistry()`. | Status: not_done
- [ ] **Implement ConfigManager.remove()** — Remove a server. Delegate to `removeServer()`. Throw `ServerNotFoundError` if it does not exist. | Status: not_done
- [ ] **Implement ConfigManager.validate()** — Validate the current config. Delegate to `validateConfig()`. | Status: not_done
- [ ] **Implement ConfigManager.has()** — Return true if a server with the given name exists in the config. | Status: not_done

### Doctor — mcp-healthcheck Integration (`src/commands/doctor.ts` extension)

- [ ] **Implement doctor --check-health** — When `--check-health` is passed, attempt to `require('mcp-healthcheck')`. If available, construct `HealthCheckOptions` from each server entry and call `checkHealth()`. Display health check results inline with other checks. If `mcp-healthcheck` is not installed, print a message suggesting installation and exit with code 2. | Status: not_done

### Edge Case Handling

- [ ] **Handle config file with Windows-style line endings** — Ensure loading and saving works correctly with `\r\n` line endings. | Status: not_done
- [ ] **Handle read-only config file** — When saving fails due to file permissions, throw a clear error with a message suggesting `chmod` or checking permissions. | Status: not_done
- [ ] **Handle config with `mcpServers: {}` (zero servers)** — Ensure all commands handle the empty servers case gracefully (list shows "No servers configured", validate passes, etc.). | Status: not_done
- [ ] **Handle adding to a non-existent config** — When `add` is called and no config file exists, create the file with `{ "mcpServers": {} }` first, then add the server. | Status: not_done
- [ ] **Handle removing the last server** — After removal, the config should have `"mcpServers": {}`, not remove the key entirely. | Status: not_done
- [ ] **Handle Cline-specific config format** — Cline wraps server entries in an additional structure with `autoApprove` arrays and `disabled` flags at the tool level. Ensure loading and saving handles these variations transparently. Per Section 5 (Config File Variations by Tool). | Status: not_done

### Phase 4 Tests

- [ ] **Write manager tests (`src/__tests__/manager.test.ts`)** — Test: load, save, getConfig (loaded and not loaded), list, get, add (and duplicate error), addFromRegistry, remove (and not-found error), validate, has. | Status: not_done
- [ ] **Write CLI integration tests (`src/__tests__/cli.test.ts`)** — Invoke the CLI binary via `child_process.execFile` for each command. Verify stdout output and exit codes. Test: `--version`, `--help`, `init`, `list`, `add` (manual and registry), `remove`, `validate` (pass and fail), `search`, `sync` (with dry-run), `doctor`. Test `--format json` output is valid JSON. Test exit codes (0, 1, 2). | Status: not_done
- [ ] **Write integration round-trip test (`src/__tests__/integration.test.ts`)** — Full round-trip: create config with `init`, add servers with `add`, validate with `validate`, sync to another file, remove a server, re-validate. Verify file on disk at each step. | Status: not_done
- [ ] **Write sync integration test** — Create two temp config files with overlapping and unique servers. Run `syncConfigs` with each conflict strategy. Read target file and verify contents. | Status: not_done
- [ ] **Write doctor integration test** — Create a config with a valid server (using `echo` as command) and a server with a missing command. Run doctor and verify pass/fail output. | Status: not_done

---

## Phase 5: Documentation and Publishing

- [ ] **Write README.md** — Comprehensive README with: overview, installation instructions (global, npx, local), CLI command reference with examples for every command, programmatic API usage with TypeScript examples, configuration options table, CI/CD integration example (GitHub Actions YAML), link to SPEC.md. | Status: not_done
- [ ] **Add JSDoc comments to all public API functions** — Document every exported function and type with JSDoc including `@param`, `@returns`, `@throws`, `@example`. | Status: not_done
- [ ] **Verify package.json metadata** — Ensure `name`, `version`, `description`, `keywords`, `author`, `license`, `repository`, `homepage`, `engines`, `bin`, `main`, `types`, `files` are all set correctly. Add relevant keywords for npm discoverability. | Status: not_done
- [ ] **Verify build output** — Run `npm run build` and verify `dist/` contains all expected files: `index.js`, `index.d.ts`, `cli.js`, all module files with declarations. Verify the `bin` entry points to a working CLI. | Status: not_done
- [ ] **Run full test suite** — Run `npm run test` and verify all tests pass. Run `npm run lint` and verify no lint errors. | Status: not_done
- [ ] **Version bump** — Bump version in package.json according to the implementation phase (0.1.0 for Phase 1, 0.2.0 for Phase 2, 0.3.0 for Phase 3, 1.0.0 for Phase 4). | Status: not_done
