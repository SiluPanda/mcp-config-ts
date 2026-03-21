import type { MCPConfig, ServerEntry } from '../types'
import { ServerExistsError, ServerNotFoundError } from '../utils/errors'

export function addServer(config: MCPConfig, name: string, entry: ServerEntry): void {
  if (Object.prototype.hasOwnProperty.call(config.servers, name)) {
    throw new ServerExistsError(name)
  }
  config.servers[name] = entry
}

export function removeServer(config: MCPConfig, name: string): void {
  if (!Object.prototype.hasOwnProperty.call(config.servers, name)) {
    throw new ServerNotFoundError(name)
  }
  delete config.servers[name]
}

export function getServer(config: MCPConfig, name: string): ServerEntry | undefined {
  return config.servers[name]
}

export function listServers(config: MCPConfig): string[] {
  return Object.keys(config.servers).sort()
}
