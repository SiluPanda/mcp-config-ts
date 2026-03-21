import { describe, it, expect } from 'vitest';
import type {
  StdioServerEntry,
  HttpServerEntry,
  MCPConfig,
  ValidationResult,
  ValidationCheck,
  SyncResult,
  SyncOptions,
  ServerInfo,
  ConfigManager,
  ManagerOptions,
  DiscoverOptions,
  RegistryEntry,
  ServerEntry,
} from '../types';

describe('Type Definitions', () => {
  describe('StdioServerEntry', () => {
    it('requires only command and type', () => {
      const entry: StdioServerEntry = { type: 'stdio', command: 'npx' };
      expect(entry.command).toBe('npx');
      expect(entry.type).toBe('stdio');
    });

    it('accepts all optional fields', () => {
      const entry: StdioServerEntry = {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { API_KEY: 'abc' },
        cwd: '/tmp',
        disabled: false,
      };
      expect(entry.args).toEqual(['server.js']);
      expect(entry.env).toEqual({ API_KEY: 'abc' });
      expect(entry.cwd).toBe('/tmp');
      expect(entry.disabled).toBe(false);
    });
  });

  describe('HttpServerEntry', () => {
    it('requires only url and type', () => {
      const entry: HttpServerEntry = { type: 'http', url: 'https://mcp.example.com' };
      expect(entry.url).toBe('https://mcp.example.com');
      expect(entry.type).toBe('http');
    });

    it('accepts optional headers and disabled', () => {
      const entry: HttpServerEntry = {
        type: 'http',
        url: 'https://mcp.example.com',
        headers: { Authorization: 'Bearer token' },
        disabled: true,
      };
      expect(entry.headers).toEqual({ Authorization: 'Bearer token' });
      expect(entry.disabled).toBe(true);
    });
  });

  describe('ServerEntry union type', () => {
    it('accepts StdioServerEntry', () => {
      const entry: ServerEntry = { type: 'stdio', command: 'npx' };
      expect(entry.type).toBe('stdio');
    });

    it('accepts HttpServerEntry', () => {
      const entry: ServerEntry = { type: 'http', url: 'https://example.com' };
      expect(entry.type).toBe('http');
    });
  });

  describe('MCPConfig', () => {
    it('requires servers and filePath', () => {
      const config: MCPConfig = {
        servers: {},
        filePath: '/tmp/.mcp.json',
      };
      expect(config.servers).toEqual({});
      expect(config.filePath).toBe('/tmp/.mcp.json');
    });

    it('accepts _otherKeys', () => {
      const config: MCPConfig = {
        servers: {},
        filePath: '/tmp/.mcp.json',
        _otherKeys: { someOtherSetting: true },
      };
      expect(config._otherKeys).toEqual({ someOtherSetting: true });
    });

    it('servers map contains ServerEntry values', () => {
      const config: MCPConfig = {
        servers: {
          github: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
          remote: { type: 'http', url: 'https://mcp.example.com' },
        },
        filePath: '.mcp.json',
      };
      expect(Object.keys(config.servers)).toHaveLength(2);
    });
  });

  describe('ValidationCheck', () => {
    it('has required fields id, severity, passed, message', () => {
      const check: ValidationCheck = {
        id: 'json-syntax',
        severity: 'error',
        passed: true,
        message: 'JSON is valid',
      };
      expect(check.id).toBe('json-syntax');
      expect(check.severity).toBe('error');
      expect(check.passed).toBe(true);
    });

    it('severity is constrained to error | warning', () => {
      const warnCheck: ValidationCheck = {
        id: 'placeholder-env',
        severity: 'warning',
        passed: false,
        message: 'Placeholder value detected',
        serverName: 'github',
        suggestion: 'Replace ${GITHUB_TOKEN} with actual value',
      };
      expect(warnCheck.severity).toBe('warning');
      expect(warnCheck.serverName).toBe('github');
    });
  });

  describe('ValidationResult', () => {
    it('has valid, configPath, checks, summary, completenessScore', () => {
      const result: ValidationResult = {
        valid: true,
        configPath: '.mcp.json',
        checks: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
        completenessScore: 100,
      };
      expect(result.valid).toBe(true);
      expect(result.configPath).toBe('.mcp.json');
      expect(result.checks).toEqual([]);
      expect(result.summary.total).toBe(0);
      expect(result.completenessScore).toBe(100);
    });
  });

  describe('SyncOptions', () => {
    it('requires source, target, conflictStrategy, dryRun', () => {
      const opts: SyncOptions = {
        source: 'claude-desktop',
        target: '.mcp.json',
        conflictStrategy: 'skip',
        dryRun: false,
      };
      expect(opts.source).toBe('claude-desktop');
      expect(opts.conflictStrategy).toBe('skip');
      expect(opts.dryRun).toBe(false);
    });

    it('conflictStrategy accepts all three values', () => {
      const skip: SyncOptions['conflictStrategy'] = 'skip';
      const overwrite: SyncOptions['conflictStrategy'] = 'overwrite';
      const mergeEnv: SyncOptions['conflictStrategy'] = 'merge-env';
      expect(skip).toBe('skip');
      expect(overwrite).toBe('overwrite');
      expect(mergeEnv).toBe('merge-env');
    });
  });

  describe('SyncResult', () => {
    it('has all 5 required array/scalar fields plus errors and changed', () => {
      const result: SyncResult = {
        sourcePath: '/source/.mcp.json',
        targetPath: '/target/.mcp.json',
        added: ['github'],
        updated: [],
        skipped: ['filesystem'],
        errors: [],
        changed: true,
      };
      expect(result.added).toEqual(['github']);
      expect(result.updated).toEqual([]);
      expect(result.skipped).toEqual(['filesystem']);
      expect(result.errors).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('errors array contains serverName and error fields', () => {
      const result: SyncResult = {
        sourcePath: 'a',
        targetPath: 'b',
        added: [],
        updated: [],
        skipped: [],
        errors: [{ serverName: 'badserver', error: 'parse failed' }],
        changed: false,
      };
      expect(result.errors[0].serverName).toBe('badserver');
      expect(result.errors[0].error).toBe('parse failed');
    });
  });

  describe('ServerInfo', () => {
    it('has name, description, npmPackage, category, source fields', () => {
      const info: ServerInfo = {
        name: 'github',
        description: 'GitHub API server',
        npmPackage: '@modelcontextprotocol/server-github',
        category: 'official',
        requiredEnvVars: [{ name: 'GITHUB_TOKEN', description: 'PAT', sensitive: true }],
        source: 'registry',
      };
      expect(info.name).toBe('github');
      expect(info.source).toBe('registry');
    });

    it('source is constrained to registry | npm', () => {
      const fromRegistry: ServerInfo['source'] = 'registry';
      const fromNpm: ServerInfo['source'] = 'npm';
      expect(fromRegistry).toBe('registry');
      expect(fromNpm).toBe('npm');
    });
  });

  describe('ManagerOptions', () => {
    it('all fields are optional', () => {
      const opts: ManagerOptions = {};
      expect(opts.configPath).toBeUndefined();
      expect(opts.validationLevel).toBeUndefined();
    });

    it('accepts configPath and validationLevel', () => {
      const opts: ManagerOptions = { configPath: '.mcp.json', validationLevel: 3 };
      expect(opts.configPath).toBe('.mcp.json');
      expect(opts.validationLevel).toBe(3);
    });
  });

  describe('DiscoverOptions', () => {
    it('all fields are optional', () => {
      const opts: DiscoverOptions = {};
      expect(opts.searchNpm).toBeUndefined();
      expect(opts.limit).toBeUndefined();
    });

    it('accepts searchNpm and limit', () => {
      const opts: DiscoverOptions = { searchNpm: true, limit: 10 };
      expect(opts.searchNpm).toBe(true);
      expect(opts.limit).toBe(10);
    });
  });

  describe('ConfigManager interface', () => {
    it('can be implemented by a mock', async () => {
      const mockConfig: MCPConfig = { servers: {}, filePath: '.mcp.json' };
      const mockValidationResult: ValidationResult = {
        valid: true,
        configPath: '.mcp.json',
        checks: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
        completenessScore: 100,
      };

      const manager: ConfigManager = {
        load: async () => { /* noop */ },
        save: async () => { /* noop */ },
        getConfig: () => mockConfig,
        list: () => [],
        get: (_name: string) => undefined,
        add: (_name: string, _entry: ServerEntry) => { /* noop */ },
        addFromRegistry: (_name: string, _env?: Record<string, string>) => { /* noop */ },
        remove: (_name: string) => { /* noop */ },
        validate: async (_opts?: { level?: 1 | 2 | 3 | 4 | 5 }) => mockValidationResult,
        has: (_name: string) => false,
      };

      await manager.load();
      expect(manager.getConfig()).toBe(mockConfig);
      expect(manager.list()).toEqual([]);
      expect(manager.has('anything')).toBe(false);
      const validation = await manager.validate({ level: 3 });
      expect(validation.valid).toBe(true);
    });
  });

  describe('RegistryEntry', () => {
    it('has required fields name, description, npmPackage, category, entry, keywords', () => {
      const entry: RegistryEntry = {
        name: 'github',
        description: 'GitHub API server',
        npmPackage: '@modelcontextprotocol/server-github',
        category: 'official',
        entry: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
        keywords: ['github', 'git', 'api'],
      };
      expect(entry.name).toBe('github');
      expect(entry.keywords).toContain('github');
    });
  });
});
