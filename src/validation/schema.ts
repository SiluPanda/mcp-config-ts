import type { MCPConfig, ValidationCheck } from '../types'

export function validateSchema(config: MCPConfig): ValidationCheck[] {
  const checks: ValidationCheck[] = []

  // Check 1: mcpServers key exists and is object
  const hasMcpServers =
    config.servers != null &&
    typeof config.servers === 'object' &&
    !Array.isArray(config.servers)

  checks.push({
    id: 'has-mcp-servers',
    severity: 'error',
    passed: hasMcpServers,
    message: hasMcpServers
      ? 'mcpServers key exists and is an object'
      : 'mcpServers key is missing or not an object',
  })

  if (!hasMcpServers) {
    return checks
  }

  const entries = Object.entries(config.servers)

  // Check 2: each entry has command or url
  const invalidEntries = entries.filter(
    ([, entry]) => entry.type !== 'stdio' && entry.type !== 'http',
  )
  const serverEntriesValid = invalidEntries.length === 0

  checks.push({
    id: 'server-entries-valid',
    severity: 'error',
    passed: serverEntriesValid,
    message: serverEntriesValid
      ? 'All server entries have a valid transport (command or url)'
      : `Server entries missing transport: ${invalidEntries.map(([name]) => name).join(', ')}`,
  })

  // Check 3: no empty names (warning)
  const emptyNames = entries.filter(([name]) => name === '')
  const noEmptyNames = emptyNames.length === 0

  checks.push({
    id: 'no-empty-names',
    severity: 'warning',
    passed: noEmptyNames,
    message: noEmptyNames
      ? 'All server names are non-empty'
      : 'One or more server names are empty strings',
  })

  // Check 4: http entries have valid URL (warning)
  const httpEntries = entries.filter(([, entry]) => entry.type === 'http')
  const badUrls = httpEntries.filter(([, entry]) => {
    const url = (entry as { url: string }).url
    return !url.startsWith('http://') && !url.startsWith('https://')
  })
  const urlFormatOk = badUrls.length === 0

  checks.push({
    id: 'url-format',
    severity: 'warning',
    passed: urlFormatOk,
    message: urlFormatOk
      ? 'All HTTP server URLs start with http:// or https://'
      : `HTTP servers with invalid URL format: ${badUrls.map(([name]) => name).join(', ')}`,
  })

  // Check 5: stdio entries have non-empty command (warning)
  const stdioEntries = entries.filter(([, entry]) => entry.type === 'stdio')
  const badCommands = stdioEntries.filter(([, entry]) => {
    const command = (entry as { command: string }).command
    return typeof command !== 'string' || command.trim() === ''
  })
  const commandNonEmpty = badCommands.length === 0

  checks.push({
    id: 'command-non-empty',
    severity: 'warning',
    passed: commandNonEmpty,
    message: commandNonEmpty
      ? 'All stdio server commands are non-empty'
      : `Stdio servers with empty command: ${badCommands.map(([name]) => name).join(', ')}`,
  })

  return checks
}
