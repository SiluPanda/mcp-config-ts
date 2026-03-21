import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { MCPConfig, ServerEntry, StdioServerEntry, HttpServerEntry } from '../types'

function serializeEntry(entry: ServerEntry): Record<string, unknown> {
  if (entry.type === 'stdio') {
    const e = entry as StdioServerEntry
    const out: Record<string, unknown> = { command: e.command }
    if (e.args != null) out.args = e.args
    if (e.env != null) out.env = e.env
    if (e.cwd != null) out.cwd = e.cwd
    if (e.disabled != null) out.disabled = e.disabled
    return out
  } else {
    const e = entry as HttpServerEntry
    const out: Record<string, unknown> = { url: e.url }
    if (e.headers != null) out.headers = e.headers
    if (e.disabled != null) out.disabled = e.disabled
    return out
  }
}

export function saveConfig(config: MCPConfig): void {
  const dir = dirname(config.filePath)
  mkdirSync(dir, { recursive: true })

  const mcpServers: Record<string, unknown> = {}
  for (const [name, entry] of Object.entries(config.servers)) {
    mcpServers[name] = serializeEntry(entry)
  }

  const output: Record<string, unknown> = { ...(config._otherKeys ?? {}), mcpServers }

  writeFileSync(config.filePath, JSON.stringify(output, null, 2) + '\n', 'utf-8')
}
