import { describe, it, expect, beforeEach } from 'vitest';
import {
  MCPConfigError,
  ConfigNotFoundError,
  ConfigParseError,
  ServerExistsError,
  ServerNotFoundError,
  ValidationError,
} from '../../utils/errors';

describe('Error Classes', () => {
  describe('MCPConfigError', () => {
    it('has correct name', () => {
      const err = new MCPConfigError('something went wrong', 'SOME_ERROR');
      expect(err.name).toBe('MCPConfigError');
    });

    it('has correct message', () => {
      const err = new MCPConfigError('test message', 'TEST_CODE');
      expect(err.message).toBe('test message');
    });

    it('has correct code', () => {
      const err = new MCPConfigError('test', 'MY_CODE');
      expect(err.code).toBe('MY_CODE');
    });

    it('is an instance of Error', () => {
      const err = new MCPConfigError('test', 'CODE');
      expect(err).toBeInstanceOf(Error);
    });

    it('is an instance of MCPConfigError', () => {
      const err = new MCPConfigError('test', 'CODE');
      expect(err).toBeInstanceOf(MCPConfigError);
    });
  });

  describe('ConfigNotFoundError', () => {
    const configPath = '/path/to/.mcp.json';
    let err: ConfigNotFoundError;

    beforeEach(() => {
      err = new ConfigNotFoundError(configPath);
    });

    it('has correct name', () => {
      expect(err.name).toBe('ConfigNotFoundError');
    });

    it('exposes configPath', () => {
      expect(err.configPath).toBe(configPath);
    });

    it('has code CONFIG_NOT_FOUND', () => {
      expect(err.code).toBe('CONFIG_NOT_FOUND');
    });

    it('message contains path', () => {
      expect(err.message).toContain(configPath);
    });

    it('is instanceof MCPConfigError', () => {
      expect(err).toBeInstanceOf(MCPConfigError);
    });

    it('is instanceof Error', () => {
      expect(err).toBeInstanceOf(Error);
    });

    it('is instanceof ConfigNotFoundError', () => {
      expect(err).toBeInstanceOf(ConfigNotFoundError);
    });
  });

  describe('ConfigParseError', () => {
    const configPath = '/path/to/bad.json';
    let err: ConfigParseError;

    beforeEach(() => {
      err = new ConfigParseError('Unexpected token at line 1', configPath);
    });

    it('has correct name', () => {
      expect(err.name).toBe('ConfigParseError');
    });

    it('exposes configPath', () => {
      expect(err.configPath).toBe(configPath);
    });

    it('has code CONFIG_PARSE_ERROR', () => {
      expect(err.code).toBe('CONFIG_PARSE_ERROR');
    });

    it('is instanceof MCPConfigError', () => {
      expect(err).toBeInstanceOf(MCPConfigError);
    });

    it('is instanceof Error', () => {
      expect(err).toBeInstanceOf(Error);
    });

    it('accepts optional parseError', () => {
      const syntaxError = new SyntaxError('Unexpected token');
      const errWithParse = new ConfigParseError('Failed to parse', configPath, syntaxError);
      expect(errWithParse.parseError).toBe(syntaxError);
    });
  });

  describe('ServerExistsError', () => {
    const serverName = 'github';
    let err: ServerExistsError;

    beforeEach(() => {
      err = new ServerExistsError(serverName);
    });

    it('has correct name', () => {
      expect(err.name).toBe('ServerExistsError');
    });

    it('exposes serverName', () => {
      expect(err.serverName).toBe(serverName);
    });

    it('has code SERVER_EXISTS', () => {
      expect(err.code).toBe('SERVER_EXISTS');
    });

    it('message contains server name', () => {
      expect(err.message).toContain(serverName);
    });

    it('is instanceof MCPConfigError', () => {
      expect(err).toBeInstanceOf(MCPConfigError);
    });

    it('is instanceof Error', () => {
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('ServerNotFoundError', () => {
    const serverName = 'missing-server';
    let err: ServerNotFoundError;

    beforeEach(() => {
      err = new ServerNotFoundError(serverName);
    });

    it('has correct name', () => {
      expect(err.name).toBe('ServerNotFoundError');
    });

    it('exposes serverName', () => {
      expect(err.serverName).toBe(serverName);
    });

    it('has code SERVER_NOT_FOUND', () => {
      expect(err.code).toBe('SERVER_NOT_FOUND');
    });

    it('message contains server name', () => {
      expect(err.message).toContain(serverName);
    });

    it('is instanceof MCPConfigError', () => {
      expect(err).toBeInstanceOf(MCPConfigError);
    });

    it('is instanceof Error', () => {
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    const errors = ['mcpServers key is missing', 'command is required for stdio entry'];
    let err: ValidationError;

    beforeEach(() => {
      err = new ValidationError('Config validation failed', errors);
    });

    it('has correct name', () => {
      expect(err.name).toBe('ValidationError');
    });

    it('exposes errors array', () => {
      expect(err.errors).toEqual(errors);
    });

    it('has code VALIDATION_ERROR', () => {
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('errors array is accessible and contains expected items', () => {
      expect(err.errors).toHaveLength(2);
      expect(err.errors[0]).toBe('mcpServers key is missing');
    });

    it('is instanceof MCPConfigError', () => {
      expect(err).toBeInstanceOf(MCPConfigError);
    });

    it('is instanceof Error', () => {
      expect(err).toBeInstanceOf(Error);
    });

    it('accepts optional result', () => {
      const mockResult = {
        valid: false,
        configPath: '.mcp.json',
        checks: [],
        summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
        completenessScore: 0,
      };
      const errWithResult = new ValidationError('Validation failed', errors, mockResult);
      expect(errWithResult.result).toBe(mockResult);
    });
  });

  describe('instanceof chain for all subclasses', () => {
    it('ConfigNotFoundError instanceof MCPConfigError AND Error', () => {
      const e = new ConfigNotFoundError('/tmp/.mcp.json');
      expect(e).toBeInstanceOf(MCPConfigError);
      expect(e).toBeInstanceOf(Error);
    });

    it('ConfigParseError instanceof MCPConfigError AND Error', () => {
      const e = new ConfigParseError('bad json', '/tmp/bad.json');
      expect(e).toBeInstanceOf(MCPConfigError);
      expect(e).toBeInstanceOf(Error);
    });

    it('ServerExistsError instanceof MCPConfigError AND Error', () => {
      const e = new ServerExistsError('github');
      expect(e).toBeInstanceOf(MCPConfigError);
      expect(e).toBeInstanceOf(Error);
    });

    it('ServerNotFoundError instanceof MCPConfigError AND Error', () => {
      const e = new ServerNotFoundError('missing');
      expect(e).toBeInstanceOf(MCPConfigError);
      expect(e).toBeInstanceOf(Error);
    });

    it('ValidationError instanceof MCPConfigError AND Error', () => {
      const e = new ValidationError('failed', []);
      expect(e).toBeInstanceOf(MCPConfigError);
      expect(e).toBeInstanceOf(Error);
    });
  });
});
