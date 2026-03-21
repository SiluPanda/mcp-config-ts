import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { loadConfig } from '../../config/load'
import { ConfigNotFoundError, ConfigParseError } from '../../utils/errors'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mcp-config-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('loadConfig', () => {
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

  it('throws ConfigNotFoundError when file does not exist', () => {
    const dir = tmpDir()
    expect(() => loadConfig(join(dir, 'nonexistent.json'))).toThrow(ConfigNotFoundError)
  })

  it('throws ConfigParseError for invalid JSON', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, '{ this is not valid json }')
    expect(() => loadConfig(file)).toThrow(ConfigParseError)
  })

  it('loads a valid stdio-only config', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
      },
    }))
    const config = loadConfig(file)
    expect(config.filePath).toBe(file)
    expect(config.servers.filesystem).toBeDefined()
    expect(config.servers.filesystem.type).toBe('stdio')
  })

  it('parses stdio entry fields correctly', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'ghp_test' },
          cwd: '/home/user',
          disabled: true,
        },
      },
    }))
    const config = loadConfig(file)
    const entry = config.servers.github
    expect(entry.type).toBe('stdio')
    if (entry.type === 'stdio') {
      expect(entry.command).toBe('npx')
      expect(entry.args).toEqual(['-y', '@modelcontextprotocol/server-github'])
      expect(entry.env).toEqual({ GITHUB_TOKEN: 'ghp_test' })
      expect(entry.cwd).toBe('/home/user')
      expect(entry.disabled).toBe(true)
    }
  })

  it('parses http entry fields correctly', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/api',
          headers: { Authorization: 'Bearer token' },
          disabled: false,
        },
      },
    }))
    const config = loadConfig(file)
    const entry = config.servers.remote
    expect(entry.type).toBe('http')
    if (entry.type === 'http') {
      expect(entry.url).toBe('https://mcp.example.com/api')
      expect(entry.headers).toEqual({ Authorization: 'Bearer token' })
      expect(entry.disabled).toBe(false)
    }
  })

  it('handles mixed stdio and http entries', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {
        local: { command: 'node', args: ['server.js'] },
        remote: { url: 'https://mcp.example.com/api' },
      },
    }))
    const config = loadConfig(file)
    expect(config.servers.local.type).toBe('stdio')
    expect(config.servers.remote.type).toBe('http')
  })

  it('preserves _otherKeys from the raw JSON', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({
      mcpServers: {},
      someOtherSetting: true,
      version: 2,
    }))
    const config = loadConfig(file)
    expect(config._otherKeys).toBeDefined()
    expect(config._otherKeys?.someOtherSetting).toBe(true)
    expect(config._otherKeys?.version).toBe(2)
  })

  it('does not set _otherKeys when only mcpServers key is present', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({ mcpServers: {} }))
    const config = loadConfig(file)
    expect(config._otherKeys).toBeUndefined()
  })

  it('loads an empty servers object when mcpServers is missing', () => {
    const dir = tmpDir()
    const file = join(dir, '.mcp.json')
    writeFileSync(file, JSON.stringify({ other: 'data' }))
    const config = loadConfig(file)
    expect(config.servers).toEqual({})
    expect(config._otherKeys?.other).toBe('data')
  })
})
