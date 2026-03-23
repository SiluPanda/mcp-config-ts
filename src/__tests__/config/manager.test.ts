import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { createManager } from '../../config/manager'
import { ServerExistsError, ServerNotFoundError } from '../../utils/errors'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mcp-config-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('createManager', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    dirs.length = 0
  })

  function makeConfigFile(content: object): string {
    const dir = makeTmpDir()
    dirs.push(dir)
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify(content))
    return file
  }

  it('throws before load is called', () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    expect(() => manager.getConfig()).toThrow()
  })

  it('load() populates the config', async () => {
    const file = makeConfigFile({ mcpServers: { myserver: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    const config = manager.getConfig()
    expect(config.servers).toHaveProperty('myserver')
  })

  it('list() returns sorted server names', async () => {
    const file = makeConfigFile({
      mcpServers: {
        zebra: { command: 'z' },
        alpha: { command: 'a' },
        mango: { url: 'https://example.com' },
      },
    })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(manager.list()).toEqual(['alpha', 'mango', 'zebra'])
  })

  it('get() returns the server entry', async () => {
    const file = makeConfigFile({ mcpServers: { myserver: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    const entry = manager.get('myserver')
    expect(entry).toBeDefined()
    expect(entry?.type).toBe('stdio')
  })

  it('get() returns undefined for unknown server', async () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(manager.get('nonexistent')).toBeUndefined()
  })

  it('has() returns true for existing server', async () => {
    const file = makeConfigFile({ mcpServers: { s: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(manager.has('s')).toBe(true)
  })

  it('has() returns false for missing server', async () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(manager.has('missing')).toBe(false)
  })

  it('add() adds a new server', async () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    await manager.load()
    manager.add('newserver', { type: 'stdio', command: 'npx' })
    expect(manager.has('newserver')).toBe(true)
    expect(manager.get('newserver')?.type).toBe('stdio')
  })

  it('add() throws ServerExistsError if server already exists', async () => {
    const file = makeConfigFile({ mcpServers: { existing: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(() => manager.add('existing', { type: 'stdio', command: 'node' })).toThrow(ServerExistsError)
  })

  it('remove() removes an existing server', async () => {
    const file = makeConfigFile({ mcpServers: { toremove: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    manager.remove('toremove')
    expect(manager.has('toremove')).toBe(false)
    expect(manager.list()).toHaveLength(0)
  })

  it('remove() throws ServerNotFoundError if server does not exist', async () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(() => manager.remove('missing')).toThrow(ServerNotFoundError)
  })

  it('save() persists mutations to disk', async () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    await manager.load()
    manager.add('saved-server', { type: 'http', url: 'https://example.com' })
    await manager.save()

    // Reload from disk with a new manager
    const manager2 = createManager({ configPath: file })
    await manager2.load()
    expect(manager2.has('saved-server')).toBe(true)
    expect(manager2.get('saved-server')?.type).toBe('http')
  })

  it('validate() returns a ValidationResult', async () => {
    const file = makeConfigFile({ mcpServers: { s: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    const result = await manager.validate({ level: 3 })
    expect(result.valid).toBeDefined()
    expect(result.checks).toBeDefined()
    expect(result.completenessScore).toBeGreaterThanOrEqual(0)
  })

  it('validate() accepts levels 1, 2, and 3', async () => {
    const file = makeConfigFile({ mcpServers: { s: { command: 'node' } } })
    const manager = createManager({ configPath: file })
    await manager.load()
    for (const level of [1, 2, 3] as const) {
      const result = await manager.validate({ level })
      expect(result.valid).toBeDefined()
      expect(result.checks).toBeDefined()
    }
  })

  it('addFromRegistry throws not-implemented error', async () => {
    const file = makeConfigFile({ mcpServers: {} })
    const manager = createManager({ configPath: file })
    await manager.load()
    expect(() => manager.addFromRegistry('some-registry')).toThrow('not yet implemented')
  })
})
