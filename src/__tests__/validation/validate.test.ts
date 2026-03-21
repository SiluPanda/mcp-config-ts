import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { validateConfig } from '../../validation/validate'
import type { MCPConfig } from '../../types'

describe('validateConfig', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    dirs.length = 0
  })

  function tmpFile(content: string): string {
    const dir = join(tmpdir(), `mcp-config-test-${randomUUID()}`)
    mkdirSync(dir, { recursive: true })
    dirs.push(dir)
    const file = join(dir, '.mcp.json')
    writeFileSync(file, content)
    return file
  }

  function makeConfig(servers: MCPConfig['servers'], filePath: string, _otherKeys?: Record<string, unknown>): MCPConfig {
    return { servers, filePath, _otherKeys }
  }

  it('valid config with stdio server passes all checks', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: { fs: { command: 'npx' } } }))
    const config = makeConfig({ fs: { type: 'stdio', command: 'npx' } }, file)
    const result = await validateConfig(config)
    expect(result.valid).toBe(true)
    expect(result.completenessScore).toBe(100)
    expect(result.summary.failed).toBe(0)
  })

  it('valid config with http server passes', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: { r: { url: 'https://example.com' } } }))
    const config = makeConfig({ r: { type: 'http', url: 'https://example.com' } }, file)
    const result = await validateConfig(config)
    expect(result.valid).toBe(true)
  })

  it('file not found produces json-syntax failure', async () => {
    const config = makeConfig({}, '/nonexistent/path/.mcp.json')
    const result = await validateConfig(config)
    const syntaxCheck = result.checks.find(c => c.id === 'json-syntax')
    expect(syntaxCheck?.passed).toBe(false)
  })

  it('invalid JSON produces json-syntax failure', async () => {
    const file = tmpFile('{ this is not json }')
    const config = makeConfig({}, file)
    const result = await validateConfig(config)
    expect(result.valid).toBe(false)
    const syntaxCheck = result.checks.find(c => c.id === 'json-syntax')
    expect(syntaxCheck?.passed).toBe(false)
  })

  it('level 1 only includes json-syntax check', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: {} }))
    const config = makeConfig({}, file)
    const result = await validateConfig(config, { level: 1 })
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0].id).toBe('json-syntax')
  })

  it('level 2 includes json-syntax and schema checks', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: {} }))
    const config = makeConfig({}, file)
    const result = await validateConfig(config, { level: 2 })
    expect(result.checks.length).toBeGreaterThan(1)
    expect(result.checks.some(c => c.id === 'json-syntax')).toBe(true)
    expect(result.checks.some(c => c.id === 'has-mcp-servers')).toBe(true)
  })

  it('level 3 (default) includes all checks', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: {} }))
    const config = makeConfig({}, file)
    const result = await validateConfig(config, { level: 3 })
    expect(result.checks.some(c => c.id === 'json-syntax')).toBe(true)
    expect(result.checks.some(c => c.id === 'has-mcp-servers')).toBe(true)
    expect(result.checks.some(c => c.id === 'url-format')).toBe(true)
  })

  it('http server with invalid URL produces url-format warning', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: { bad: { url: 'ftp://invalid' } } }))
    const config = makeConfig({ bad: { type: 'http', url: 'ftp://invalid' } }, file)
    const result = await validateConfig(config)
    const urlCheck = result.checks.find(c => c.id === 'url-format')
    expect(urlCheck?.passed).toBe(false)
    expect(urlCheck?.severity).toBe('warning')
  })

  it('valid is false only when error-severity checks fail', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: { r: { url: 'ftp://bad' } } }))
    const config = makeConfig({ r: { type: 'http', url: 'ftp://bad' } }, file)
    const result = await validateConfig(config)
    // url-format is a warning, json-syntax passes, has-mcp-servers passes
    expect(result.valid).toBe(true)
  })

  it('completenessScore is reduced by warning failures', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: { r: { url: 'ftp://bad' } } }))
    const config = makeConfig({ r: { type: 'http', url: 'ftp://bad' } }, file)
    const result = await validateConfig(config)
    expect(result.completenessScore).toBeLessThan(100)
  })

  it('completenessScore is 0 or clamped when many errors', async () => {
    const config = makeConfig({}, '/nonexistent/.mcp.json')
    const result = await validateConfig(config)
    expect(result.completenessScore).toBeGreaterThanOrEqual(0)
    expect(result.completenessScore).toBeLessThanOrEqual(100)
  })

  it('configPath in result matches config.filePath', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: {} }))
    const config = makeConfig({}, file)
    const result = await validateConfig(config)
    expect(result.configPath).toBe(file)
  })

  it('summary counts are correct', async () => {
    const file = tmpFile(JSON.stringify({ mcpServers: { s: { command: 'node' } } }))
    const config = makeConfig({ s: { type: 'stdio', command: 'node' } }, file)
    const result = await validateConfig(config)
    expect(result.summary.total).toBe(result.checks.length)
    expect(result.summary.passed + result.summary.failed).toBe(result.summary.total)
  })
})
