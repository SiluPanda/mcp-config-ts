import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname);

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

function parseFixture(name: string): unknown {
  return JSON.parse(readFixture(name));
}

describe('Fixture Files', () => {
  describe('valid-config.json', () => {
    it('parses as valid JSON', () => {
      expect(() => parseFixture('valid-config.json')).not.toThrow();
    });

    it('has mcpServers key', () => {
      const data = parseFixture('valid-config.json') as { mcpServers: Record<string, unknown> };
      expect(data).toHaveProperty('mcpServers');
    });

    it('has exactly 2 server entries', () => {
      const data = parseFixture('valid-config.json') as { mcpServers: Record<string, unknown> };
      expect(Object.keys(data.mcpServers)).toHaveLength(2);
    });

    it('contains filesystem and github entries', () => {
      const data = parseFixture('valid-config.json') as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers).toHaveProperty('filesystem');
      expect(data.mcpServers).toHaveProperty('github');
    });
  });

  describe('invalid-json.txt', () => {
    it('is readable and not empty', () => {
      const content = readFixture('invalid-json.txt');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });

    it('is not valid JSON', () => {
      const content = readFixture('invalid-json.txt');
      expect(() => JSON.parse(content)).toThrow(SyntaxError);
    });
  });

  describe('missing-mcpservers.json', () => {
    it('parses as valid JSON', () => {
      expect(() => parseFixture('missing-mcpservers.json')).not.toThrow();
    });

    it('lacks mcpServers key', () => {
      const data = parseFixture('missing-mcpservers.json') as Record<string, unknown>;
      expect(data).not.toHaveProperty('mcpServers');
    });

    it('has other keys', () => {
      const data = parseFixture('missing-mcpservers.json') as Record<string, unknown>;
      expect(data).toHaveProperty('other');
    });
  });

  describe('mixed-transport.json', () => {
    it('parses as valid JSON', () => {
      expect(() => parseFixture('mixed-transport.json')).not.toThrow();
    });

    it('has a stdio entry (local) with command', () => {
      const data = parseFixture('mixed-transport.json') as {
        mcpServers: Record<string, { command?: string; url?: string }>;
      };
      expect(data.mcpServers.local).toHaveProperty('command');
      expect(data.mcpServers.local.command).toBe('node');
    });

    it('has an http entry (remote) with url', () => {
      const data = parseFixture('mixed-transport.json') as {
        mcpServers: Record<string, { command?: string; url?: string }>;
      };
      expect(data.mcpServers.remote).toHaveProperty('url');
      expect(data.mcpServers.remote.url).toBe('https://mcp.example.com/api');
    });
  });

  describe('placeholder-env.json', () => {
    it('parses as valid JSON', () => {
      expect(() => parseFixture('placeholder-env.json')).not.toThrow();
    });

    it('has ${...} placeholder values in env', () => {
      const data = parseFixture('placeholder-env.json') as {
        mcpServers: {
          service: {
            env: Record<string, string>;
          };
        };
      };
      const env = data.mcpServers.service.env;
      expect(env.API_KEY).toMatch(/^\$\{.+\}$/);
      expect(env.SECRET).toMatch(/^\$\{.+\}$/);
    });

    it('API_KEY placeholder is ${API_KEY}', () => {
      const data = parseFixture('placeholder-env.json') as {
        mcpServers: { service: { env: Record<string, string> } };
      };
      expect(data.mcpServers.service.env.API_KEY).toBe('${API_KEY}');
    });
  });

  describe('claude-desktop-config.json', () => {
    it('parses as valid JSON', () => {
      expect(() => parseFixture('claude-desktop-config.json')).not.toThrow();
    });

    it('has mcpServers key', () => {
      const data = parseFixture('claude-desktop-config.json') as { mcpServers: Record<string, unknown> };
      expect(data).toHaveProperty('mcpServers');
    });

    it('has claude-filesystem entry', () => {
      const data = parseFixture('claude-desktop-config.json') as {
        mcpServers: Record<string, { command?: string; args?: string[]; disabled?: boolean }>;
      };
      expect(data.mcpServers).toHaveProperty('claude-filesystem');
    });

    it('claude-filesystem entry has expected command and args', () => {
      const data = parseFixture('claude-desktop-config.json') as {
        mcpServers: Record<string, { command?: string; args?: string[]; disabled?: boolean }>;
      };
      const entry = data.mcpServers['claude-filesystem'];
      expect(entry.command).toBe('npx');
      expect(entry.args).toContain('@modelcontextprotocol/server-filesystem');
      expect(entry.disabled).toBe(false);
    });
  });
});
