import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { loadConfig } from '../../config/load'
import { saveConfig } from '../../config/save'
import { writeFileSync } from 'fs'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mcp-config-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('saveConfig', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    dirs.length = 0
  })

  function tmpDir(): string {
    const d = makeTmpDir()
    dirs.push(d)
    return d
  }

  it('writes valid JSON with mcpServers key', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    const config = {
      servers: { myserver: { type: 'stdio' as const, command: 'node' } },
      filePath: file,
    }
    saveConfig(config)
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    expect(raw).toHaveProperty('mcpServers')
    expect(raw.mcpServers).toHaveProperty('myserver')
  })

  it('strips the type field from saved entries', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    const config = {
      servers: { myserver: { type: 'stdio' as const, command: 'node' } },
      filePath: file,
    }
    saveConfig(config)
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    expect(raw.mcpServers.myserver).not.toHaveProperty('type')
    expect(raw.mcpServers.myserver.command).toBe('node')
  })

  it('strips type from http entries too', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    const config = {
      servers: { remote: { type: 'http' as const, url: 'https://example.com' } },
      filePath: file,
    }
    saveConfig(config)
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    expect(raw.mcpServers.remote).not.toHaveProperty('type')
    expect(raw.mcpServers.remote.url).toBe('https://example.com')
  })

  it('round-trips a config: load → modify → save → reload', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {
        github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
      },
    }))

    const config = loadConfig(file)
    config.servers.newserver = { type: 'http', url: 'https://new.example.com' }
    saveConfig(config)

    const reloaded = loadConfig(file)
    expect(Object.keys(reloaded.servers)).toHaveLength(2)
    expect(reloaded.servers.github.type).toBe('stdio')
    expect(reloaded.servers.newserver.type).toBe('http')
  })

  it('preserves _otherKeys on round-trip', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {},
      extraSetting: 'preserved',
    }))

    const config = loadConfig(file)
    saveConfig(config)

    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    expect(raw.extraSetting).toBe('preserved')
  })

  it('creates parent directories if they do not exist', () => {
    const dir = tmpDir()
    const file = join(dir, 'deep', 'nested', 'dir', '.mcp.json')
    const config = {
      servers: {},
      filePath: file,
    }
    expect(() => saveConfig(config)).not.toThrow()
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    expect(raw).toHaveProperty('mcpServers')
  })

  it('writes JSON with 2-space indent and trailing newline', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    const config = {
      servers: { s: { type: 'stdio' as const, command: 'node' } },
      filePath: file,
    }
    saveConfig(config)
    const raw = readFileSync(file, 'utf-8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toContain('  ')
  })
})
