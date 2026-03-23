import { resolve } from 'path'
import type { ConfigManager, ManagerOptions, MCPConfig, ServerEntry, ValidationResult } from '../types'
import { loadConfig } from './load'
import { saveConfig } from './save'
import { validateConfig } from '../validation/validate'
import { addServer, removeServer, getServer, listServers } from './operations'

const DEFAULT_CONFIG_PATH = '.mcp.json'

export function createManager(options?: ManagerOptions): ConfigManager {
  const configPath = resolve(options?.configPath ?? DEFAULT_CONFIG_PATH)
  let _config: MCPConfig | null = null

  function assertLoaded(): MCPConfig {
    if (_config == null) {
      throw new Error('Config not loaded. Call load() first.')
    }
    return _config
  }

  return {
    async load(): Promise<void> {
      _config = loadConfig(configPath)
    },

    async save(): Promise<void> {
      const config = assertLoaded()
      saveConfig(config)
    },

    getConfig(): MCPConfig {
      return assertLoaded()
    },

    list(): string[] {
      return listServers(assertLoaded())
    },

    get(serverName: string): ServerEntry | undefined {
      return getServer(assertLoaded(), serverName)
    },

    add(serverName: string, entry: ServerEntry): void {
      addServer(assertLoaded(), serverName, entry)
    },

    addFromRegistry(_registryName: string, _envValues?: Record<string, string>): void {
      throw new Error('addFromRegistry is not yet implemented')
    },

    remove(serverName: string): void {
      removeServer(assertLoaded(), serverName)
    },

    async validate(opts?: { level?: 1 | 2 | 3 }): Promise<ValidationResult> {
      const config = assertLoaded()
      const level = opts?.level ?? 3
      return validateConfig(config, { level })
    },

    has(serverName: string): boolean {
      const config = assertLoaded()
      return Object.prototype.hasOwnProperty.call(config.servers, serverName)
    },
  }
}
