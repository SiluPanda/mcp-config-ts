import type { MCPConfig, ValidationResult, ValidationCheck } from '../types'
import { validateJsonSyntax } from './json-syntax'
import { validateSchema } from './schema'

export async function validateConfig(
  config: MCPConfig,
  options?: { level?: 1 | 2 | 3 },
): Promise<ValidationResult> {
  const level = options?.level ?? 3
  const checks: ValidationCheck[] = []

  // Level 1+: JSON syntax check
  const syntaxCheck = validateJsonSyntax(config.filePath)
  checks.push(syntaxCheck)

  // Level 2+: schema checks
  if (level >= 2) {
    const schemaChecks = validateSchema(config)
    checks.push(...schemaChecks)
  }

  // Compute summary
  const failed = checks.filter(c => !c.passed)
  const errorFailures = failed.filter(c => c.severity === 'error')
  const warningFailures = failed.filter(c => c.severity === 'warning')

  const summary = {
    total: checks.length,
    passed: checks.filter(c => c.passed).length,
    failed: failed.length,
    warnings: warningFailures.length,
  }

  const completenessScore = Math.max(
    0,
    Math.min(100, 100 - errorFailures.length * 30 - warningFailures.length * 10),
  )

  const valid = errorFailures.length === 0

  return {
    valid,
    configPath: config.filePath,
    checks,
    summary,
    completenessScore,
  }
}
