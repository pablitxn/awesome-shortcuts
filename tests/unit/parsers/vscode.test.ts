import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { vscodeParser } from '@/lib/parsers/vscode';

// Load test fixture
const fixtureContent = readFileSync(
  join(__dirname, '../../fixtures/vscode/keybindings.json'),
  'utf-8'
);

describe('vscodeParser', () => {
  describe('detect', () => {
    it('detects keybindings.json files', () => {
      expect(vscodeParser.detect('keybindings.json')).toBe(true);
      expect(vscodeParser.detect('/path/to/keybindings.json')).toBe(true);
      expect(vscodeParser.detect('~/.config/Code/User/keybindings.json')).toBe(true);
    });

    it('detects VS Code Insiders keybindings', () => {
      expect(vscodeParser.detect('/Code - Insiders/User/keybindings.json')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(vscodeParser.detect('KEYBINDINGS.JSON')).toBe(true);
      expect(vscodeParser.detect('Keybindings.JSON')).toBe(true);
    });

    it('rejects non-keybindings files', () => {
      expect(vscodeParser.detect('settings.json')).toBe(false);
      expect(vscodeParser.detect('package.json')).toBe(false);
      expect(vscodeParser.detect('keybindings.txt')).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses keybindings from fixture file', () => {
      const shortcuts = vscodeParser.parse(fixtureContent);
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it('handles empty content', () => {
      expect(vscodeParser.parse('')).toEqual([]);
      expect(vscodeParser.parse('   ')).toEqual([]);
    });

    it('handles empty array', () => {
      expect(vscodeParser.parse('[]')).toEqual([]);
    });

    it('parses simple keybindings', () => {
      const content = JSON.stringify([
        { key: 'ctrl+shift+p', command: 'workbench.action.showCommands' },
      ]);
      const shortcuts = vscodeParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl+Shift+P']);
      expect(shortcuts[0].title).toBe('Show Commands');
      expect(shortcuts[0].description).toBe('workbench.action.showCommands');
    });

    it('parses chord sequences (multi-key combos)', () => {
      const content = JSON.stringify([
        { key: 'ctrl+k ctrl+s', command: 'workbench.action.openGlobalKeybindings' },
      ]);
      const shortcuts = vscodeParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl+K', 'Ctrl+S']);
    });

    it('handles when clauses', () => {
      const content = JSON.stringify([
        {
          key: 'ctrl+`',
          command: 'workbench.action.terminal.toggleTerminal',
          when: 'terminal.active',
        },
      ]);
      const shortcuts = vscodeParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].description).toContain('when: terminal.active');
    });

    it('handles args', () => {
      const content = JSON.stringify([
        {
          key: 'ctrl+k ctrl+f',
          command: 'editor.action.formatSelection',
          args: { formatting: 'selection' },
        },
      ]);
      const shortcuts = vscodeParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].description).toContain('[has args]');
    });

    it('converts key modifiers correctly', () => {
      const testCases = [
        { input: 'ctrl+a', expected: ['Ctrl+A'] },
        { input: 'shift+b', expected: ['Shift+B'] },
        { input: 'alt+c', expected: ['Alt+C'] },
        { input: 'cmd+d', expected: ['Cmd+D'] },
        { input: 'meta+e', expected: ['Meta+E'] },
        { input: 'ctrl+shift+alt+f', expected: ['Ctrl+Shift+Alt+F'] },
      ];

      for (const { input, expected } of testCases) {
        const content = JSON.stringify([{ key: input, command: 'test' }]);
        const shortcuts = vscodeParser.parse(content);
        expect(shortcuts[0].keys).toEqual(expected);
      }
    });

    it('handles special keys', () => {
      const testCases = [
        { input: 'f12', expected: ['F12'] },
        { input: 'enter', expected: ['Enter'] },
        { input: 'escape', expected: ['Escape'] },
        { input: 'space', expected: ['Space'] },
        { input: 'tab', expected: ['Tab'] },
        { input: 'backspace', expected: ['Backspace'] },
        { input: 'up', expected: ['Up'] },
        { input: 'down', expected: ['Down'] },
        { input: 'left', expected: ['Left'] },
        { input: 'right', expected: ['Right'] },
      ];

      for (const { input, expected } of testCases) {
        const content = JSON.stringify([{ key: input, command: 'test' }]);
        const shortcuts = vscodeParser.parse(content);
        expect(shortcuts[0].keys).toEqual(expected);
      }
    });

    it('generates title from command', () => {
      const testCases = [
        { command: 'workbench.action.showCommands', expected: 'Show Commands' },
        { command: 'editor.action.deleteLines', expected: 'Delete Lines' },
        { command: 'workbench.action.quickOpen', expected: 'Quick Open' },
        { command: 'editor.action.selectHighlights', expected: 'Select Highlights' },
      ];

      for (const { command, expected } of testCases) {
        const content = JSON.stringify([{ key: 'ctrl+a', command }]);
        const shortcuts = vscodeParser.parse(content);
        expect(shortcuts[0].title).toBe(expected);
      }
    });

    it('handles negative commands (unbinding)', () => {
      const content = JSON.stringify([
        { key: '-ctrl+shift+n', command: 'workbench.action.newWindow' },
      ]);
      const shortcuts = vscodeParser.parse(content);

      expect(shortcuts[0].title).toBe('New Window');
      expect(shortcuts[0].keys).toEqual(['-Ctrl+Shift+N']);
    });

    it('throws on invalid JSON', () => {
      expect(() => vscodeParser.parse('not json')).toThrow('Invalid JSON');
    });

    it('throws on non-array JSON', () => {
      expect(() => vscodeParser.parse('{"key": "value"}')).toThrow('must be an array');
    });

    it('throws on missing key field', () => {
      const content = JSON.stringify([{ command: 'test' }]);
      expect(() => vscodeParser.parse(content)).toThrow('must have a "key" string');
    });

    it('throws on missing command field', () => {
      const content = JSON.stringify([{ key: 'ctrl+a' }]);
      expect(() => vscodeParser.parse(content)).toThrow('must have a "command" string');
    });

    it('handles comments in JSONC format', () => {
      const content = `[
        // This is a comment
        { "key": "ctrl+a", "command": "test" }
        // Another comment
      ]`;
      const shortcuts = vscodeParser.parse(content);
      expect(shortcuts).toHaveLength(1);
    });

    it('tracks source line numbers', () => {
      const content = `[
  { "key": "ctrl+a", "command": "first" },
  { "key": "ctrl+b", "command": "second" }
]`;
      const shortcuts = vscodeParser.parse(content);

      expect(shortcuts[0].sourceLine).toBe(2);
      expect(shortcuts[1].sourceLine).toBe(3);
    });
  });

  describe('inject', () => {
    it('injects into empty content', () => {
      const result = vscodeParser.inject('', {
        title: 'Test Command',
        keys: ['Ctrl+T'],
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].key).toBe('ctrl+t');
      expect(parsed[0].command).toBe('user.testCommand');
    });

    it('injects into empty array', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Test Command',
        keys: ['Ctrl+T'],
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
    });

    it('appends to existing keybindings', () => {
      const existing = JSON.stringify([
        { key: 'ctrl+a', command: 'existing.command' },
      ]);

      const result = vscodeParser.inject(existing, {
        title: 'New Command',
        keys: ['Ctrl+N'],
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].command).toBe('existing.command');
      expect(parsed[1].key).toBe('ctrl+n');
    });

    it('handles chord sequences in injection', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Format Selection',
        keys: ['Ctrl+K', 'Ctrl+F'],
      });

      const parsed = JSON.parse(result);
      expect(parsed[0].key).toBe('ctrl+k ctrl+f');
    });

    it('uses description as command if provided', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Test',
        keys: ['Ctrl+T'],
        description: 'editor.action.test',
      });

      const parsed = JSON.parse(result);
      expect(parsed[0].command).toBe('editor.action.test');
    });

    it('pretty-prints output with 2-space indentation', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Test',
        keys: ['Ctrl+T'],
      });

      expect(result).toContain('\n');
      // Check for 2-space indentation on object opening brace and key lines
      expect(result).toMatch(/^  \{/m); // Object brace has 2-space indent
      expect(result).toMatch(/^    "key"/m); // Properties have 4-space indent
    });

    it('ends with newline', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Test',
        keys: ['Ctrl+T'],
      });

      expect(result.endsWith('\n')).toBe(true);
    });

    it('strips when clause from description when injecting', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Test',
        keys: ['Ctrl+T'],
        description: 'editor.action.test (when: editorFocus)',
      });

      const parsed = JSON.parse(result);
      expect(parsed[0].command).toBe('editor.action.test');
    });

    it('strips [has args] from description when injecting', () => {
      const result = vscodeParser.inject('[]', {
        title: 'Test',
        keys: ['Ctrl+T'],
        description: 'editor.action.test [has args]',
      });

      const parsed = JSON.parse(result);
      expect(parsed[0].command).toBe('editor.action.test');
    });
  });

  describe('appId', () => {
    it('has correct appId', () => {
      expect(vscodeParser.appId).toBe('vscode');
    });
  });

  describe('integration with fixture', () => {
    it('parses all shortcuts from fixture', () => {
      const shortcuts = vscodeParser.parse(fixtureContent);

      // Verify count matches fixture
      expect(shortcuts.length).toBe(17);
    });

    it('correctly parses first shortcut', () => {
      const shortcuts = vscodeParser.parse(fixtureContent);
      const first = shortcuts[0];

      expect(first.keys).toEqual(['Ctrl+Shift+P']);
      expect(first.title).toBe('Show Commands');
      expect(first.description).toBe('workbench.action.showCommands');
    });

    it('correctly parses chord sequence shortcut', () => {
      const shortcuts = vscodeParser.parse(fixtureContent);
      const chordShortcut = shortcuts[1];

      expect(chordShortcut.keys).toEqual(['Ctrl+K', 'Ctrl+S']);
      expect(chordShortcut.title).toBe('Open Global Keybindings');
    });

    it('correctly parses shortcut with when clause', () => {
      const shortcuts = vscodeParser.parse(fixtureContent);
      const withWhen = shortcuts[2];

      expect(withWhen.keys).toEqual(['Ctrl+`']);
      expect(withWhen.description).toContain('when: terminal.active');
    });

    it('correctly parses shortcut with args', () => {
      const shortcuts = vscodeParser.parse(fixtureContent);
      const withArgs = shortcuts[15];

      expect(withArgs.keys).toEqual(['Ctrl+K', 'Ctrl+F']);
      expect(withArgs.description).toContain('[has args]');
    });

    it('can inject and re-parse', () => {
      const newShortcut = {
        title: 'Custom Action',
        keys: ['Ctrl+Alt+C'],
        description: 'custom.action.test',
      };

      const injected = vscodeParser.inject(fixtureContent, newShortcut);
      const reparsed = vscodeParser.parse(injected);

      expect(reparsed.length).toBe(18);
      const last = reparsed[reparsed.length - 1];
      expect(last.keys).toEqual(['Ctrl+Alt+C']);
    });
  });
});
