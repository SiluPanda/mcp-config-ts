import { readFileSync, existsSync } from 'fs'
import type { ValidationCheck } from '../types'

export function validateJsonSyntax(filePath: string): ValidationCheck {
  if (!existsSync(filePath)) {
    return {
      id: 'json-syntax',
      severity: 'error',
      passed: false,
      message: 'File not found',
    }
  }

  let raw: string
  try {
    raw = readFileSync(filePath, 'utf-8')
  } catch (err) {
    return {
      id: 'json-syntax',
      severity: 'error',
      passed: false,
      message: err instanceof Error ? err.message : 'Failed to read file',
    }
  }

  try {
    JSON.parse(raw)
    return {
      id: 'json-syntax',
      severity: 'error',
      passed: true,
      message: 'Valid JSON',
    }
  } catch (err) {
    return {
      id: 'json-syntax',
      severity: 'error',
      passed: false,
      message: err instanceof Error ? err.message : 'Invalid JSON',
    }
  }
}
