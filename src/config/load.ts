import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { MCPConfig, ServerEntry, StdioServerEntry, HttpServerEntry } from '../types'
import { ConfigNotFoundError, ConfigParseError } from '../utils/errors'

const DEFAULT_CONFIG_PATH = '.mcp.json'

export function loadConfig(configPath?: string): MCPConfig {
  const filePath = resolve(configPath ?? DEFAULT_CONFIG_PATH)

  if (!existsSync(filePath)) {
    throw new ConfigNotFoundError(filePath)
  }

  let raw: string
  try {
    raw = readFileSync(filePath, 'utf-8')
  } catch {
    throw new ConfigNotFoundError(filePath)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const syntaxErr = err instanceof SyntaxError ? err : undefined
    throw new ConfigParseError(
      syntaxErr?.message ?? 'Failed to parse JSON',
      filePath,
      syntaxErr,
    )
  }

  const { mcpServers, ...rest } = parsed as { mcpServers?: unknown } & Record<string, unknown>

  const servers: Record<string, ServerEntry> = {}

  if (mcpServers != null && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
    for (const [name, rawEntry] of Object.entries(mcpServers as Record<string, unknown>)) {
      if (rawEntry == null || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
        continue
      }
      const entry = rawEntry as Record<string, unknown>

      if (typeof entry.command === 'string') {
        const stdioEntry: StdioServerEntry = { type: 'stdio', command: entry.command }
        if (Array.isArray(entry.args)) stdioEntry.args = entry.args as string[]
        if (entry.env != null && typeof entry.env === 'object' && !Array.isArray(entry.env)) {
          stdioEntry.env = entry.env as Record<string, string>
        }
        if (typeof entry.cwd === 'string') stdioEntry.cwd = entry.cwd
        if (typeof entry.disabled === 'boolean') stdioEntry.disabled = entry.disabled
        servers[name] = stdioEntry
      } else if (typeof entry.url === 'string') {
        const httpEntry: HttpServerEntry = { type: 'http', url: entry.url }
        if (entry.headers != null && typeof entry.headers === 'object' && !Array.isArray(entry.headers)) {
          httpEntry.headers = entry.headers as Record<string, string>
        }
        if (typeof entry.disabled === 'boolean') httpEntry.disabled = entry.disabled
        servers[name] = httpEntry
      }
    }
  }

  const config: MCPConfig = { servers, filePath }

  if (Object.keys(rest).length > 0) {
    config._otherKeys = rest
  }

  return config
}
