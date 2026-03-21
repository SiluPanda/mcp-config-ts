import type { ValidationResult } from '../types';

/** Base error class for mcp-config-ts errors. */
export class MCPConfigError extends Error {
  readonly name: string = 'MCPConfigError';

  constructor(message: string, readonly code: string) {
    super(message);
    Object.setPrototypeOf(this, MCPConfigError.prototype);
  }
}

/** Config file not found. */
export class ConfigNotFoundError extends MCPConfigError {
  override readonly name = 'ConfigNotFoundError';

  constructor(readonly configPath: string) {
    super(`Config file not found: ${configPath}`, 'CONFIG_NOT_FOUND');
    Object.setPrototypeOf(this, ConfigNotFoundError.prototype);
  }
}

/** Config file is not valid JSON. */
export class ConfigParseError extends MCPConfigError {
  override readonly name = 'ConfigParseError';

  constructor(message: string, readonly configPath: string, readonly parseError?: SyntaxError) {
    super(message, 'CONFIG_PARSE_ERROR');
    Object.setPrototypeOf(this, ConfigParseError.prototype);
  }
}

/** Server already exists in config. */
export class ServerExistsError extends MCPConfigError {
  override readonly name = 'ServerExistsError';

  constructor(readonly serverName: string) {
    super(`Server already exists: ${serverName}`, 'SERVER_EXISTS');
    Object.setPrototypeOf(this, ServerExistsError.prototype);
  }
}

/** Server not found in config or registry. */
export class ServerNotFoundError extends MCPConfigError {
  override readonly name = 'ServerNotFoundError';

  constructor(readonly serverName: string) {
    super(`Server not found: ${serverName}`, 'SERVER_NOT_FOUND');
    Object.setPrototypeOf(this, ServerNotFoundError.prototype);
  }
}

/** Validation failed at a critical level. */
export class ValidationError extends MCPConfigError {
  override readonly name = 'ValidationError';

  constructor(message: string, readonly errors: string[], readonly result?: ValidationResult) {
    super(message, 'VALIDATION_ERROR');
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
