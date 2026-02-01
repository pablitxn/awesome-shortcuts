import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { zshParser } from '@/lib/parsers/zsh';
import type { ParsedShortcut } from '@/lib/types';

const fixturesPath = join(__dirname, '../../fixtures/zsh');

describe('zshParser', () => {
  describe('detect()', () => {
    it('should detect .zshrc files', () => {
      expect(zshParser.detect('/home/user/.zshrc')).toBe(true);
      expect(zshParser.detect('~/.zshrc')).toBe(true);
      expect(zshParser.detect('/Users/john/.zshrc')).toBe(true);
    });

    it('should detect .zsh_aliases files', () => {
      expect(zshParser.detect('/home/user/.zsh_aliases')).toBe(true);
      expect(zshParser.detect('~/.zsh_aliases')).toBe(true);
    });

    it('should detect .zshenv files', () => {
      expect(zshParser.detect('/home/user/.zshenv')).toBe(true);
    });

    it('should detect .zprofile files', () => {
      expect(zshParser.detect('/home/user/.zprofile')).toBe(true);
    });

    it('should detect files in .zsh directory', () => {
      expect(zshParser.detect('/home/user/.zsh/aliases.zsh')).toBe(true);
      expect(zshParser.detect('/home/user/.zsh/bindings.zsh')).toBe(true);
    });

    it('should detect files in zsh config directories', () => {
      expect(zshParser.detect('/home/user/.config/zsh/custom.zsh')).toBe(true);
    });

    it('should not detect non-zsh files', () => {
      expect(zshParser.detect('/home/user/.bashrc')).toBe(false);
      expect(zshParser.detect('/home/user/config.json')).toBe(false);
      expect(zshParser.detect('/home/user/.vimrc')).toBe(false);
    });
  });

  describe('parse() - bindkey commands', () => {
    it('should parse simple bindkey with ^letter (Ctrl+letter)', () => {
      const content = `bindkey '^R' history-incremental-search-backward`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0]).toMatchObject({
        title: 'history-incremental-search-backward',
        keys: ['Ctrl', 'R'],
        description: 'history-incremental-search-backward',
        sourceLine: 1,
      });
    });

    it('should extract title from preceding comment', () => {
      const content = `# History search
bindkey '^R' history-incremental-search-backward`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].title).toBe('History search');
    });

    it('should parse escape sequences for arrow keys', () => {
      const content = `bindkey '\\e[A' history-beginning-search-backward`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Up']);
    });

    it('should parse Ctrl+Arrow combinations', () => {
      const content = `bindkey '\\e[1;5C' forward-word
bindkey '\\e[1;5D' backward-word`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'Right']);
      expect(shortcuts[1].keys).toEqual(['Ctrl', 'Left']);
    });

    it('should parse Alt+letter bindings', () => {
      const content = `bindkey '\\eb' backward-word
bindkey '\\ef' forward-word`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['Alt', 'B']);
      expect(shortcuts[1].keys).toEqual(['Alt', 'F']);
    });

    it('should parse bindkey with -e flag', () => {
      const content = `bindkey -e '^T' fzf-file-widget`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'T']);
      expect(shortcuts[0].description).toBe('fzf-file-widget');
    });

    it('should parse bindkey with -M flag for vi mode', () => {
      const content = `bindkey -M viins '^R' history-incremental-search-backward`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'R']);
    });

    it('should parse multi-key combinations like ^X^E', () => {
      const content = `# Edit command in editor
bindkey '^X^E' edit-command-line`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'X', 'Ctrl', 'E']);
      expect(shortcuts[0].title).toBe('Edit command in editor');
    });

    it('should parse function keys', () => {
      const content = `bindkey '\\e[15~' my-f5-function`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['F5']);
    });

    it('should parse Home/End keys', () => {
      const content = `bindkey '\\e[H' beginning-of-line
bindkey '\\e[F' end-of-line`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['Home']);
      expect(shortcuts[1].keys).toEqual(['End']);
    });

    it('should parse Delete key', () => {
      const content = `bindkey '\\e[3~' delete-char`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Delete']);
    });
  });

  describe('parse() - alias commands', () => {
    it('should parse simple alias with single quotes', () => {
      const content = `alias gs='git status'`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0]).toMatchObject({
        title: 'gs',
        keys: ['gs'],
        description: 'git status',
        sourceLine: 1,
      });
    });

    it('should parse alias with double quotes', () => {
      const content = `alias ll="ls -la"`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['ll']);
      expect(shortcuts[0].description).toBe('ls -la');
    });

    it('should extract alias title from preceding comment', () => {
      const content = `# Git shortcuts
alias gs='git status'`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].title).toBe('Git shortcuts');
    });

    it('should parse global aliases with -g flag', () => {
      const content = `alias -g L='| less'`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['L']);
      expect(shortcuts[0].description).toBe('| less');
    });

    it('should parse suffix aliases with -s flag', () => {
      const content = `alias -s json='jq .'`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['json']);
    });

    it('should parse multiple aliases', () => {
      const content = `alias ga='git add'
alias gc='git commit'
alias gp='git push'`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(3);
      expect(shortcuts.map(s => s.keys[0])).toEqual(['ga', 'gc', 'gp']);
    });
  });

  describe('parse() - oh-my-zsh plugins', () => {
    it('should detect and parse oh-my-zsh git plugin shortcuts', () => {
      const content = `plugins=(git z fzf)
source $ZSH/oh-my-zsh.sh`;
      const shortcuts = zshParser.parse(content);

      // Should include git plugin shortcuts
      const gitShortcuts = shortcuts.filter(s => s.description?.startsWith('git '));
      expect(gitShortcuts.length).toBeGreaterThan(0);

      // Should include fzf plugin shortcuts
      const fzfShortcuts = shortcuts.filter(s => s.description?.includes('fzf'));
      expect(fzfShortcuts.length).toBeGreaterThan(0);
    });

    it('should detect plugins with newlines', () => {
      const content = `plugins=(
  git
  z
  fzf
)`;
      const shortcuts = zshParser.parse(content);
      expect(shortcuts.length).toBeGreaterThan(0);
    });
  });

  describe('parse() - mixed content', () => {
    it('should parse both bindkey and alias commands', () => {
      const content = `# Navigation
bindkey '^A' beginning-of-line

# Git alias
alias gs='git status'`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'A']);
      expect(shortcuts[1].keys).toEqual(['gs']);
    });

    it('should skip comments and empty lines', () => {
      const content = `# This is a comment

# Another comment
bindkey '^R' history-search

`;
      const shortcuts = zshParser.parse(content);
      expect(shortcuts).toHaveLength(1);
    });

    it('should skip function definitions', () => {
      const content = `function mkcd() {
  mkdir -p "$1" && cd "$1"
}

bindkey '^R' history-search`;
      const shortcuts = zshParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].description).toBe('history-search');
    });
  });

  describe('parse() - fixture file', () => {
    let fixtureContent: string;
    let shortcuts: ParsedShortcut[];

    beforeAll(() => {
      fixtureContent = readFileSync(join(fixturesPath, '.zshrc'), 'utf-8');
      shortcuts = zshParser.parse(fixtureContent);
    });

    it('should parse the fixture file without errors', () => {
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it('should find bindkey shortcuts', () => {
      const bindkeyShortcuts = shortcuts.filter(
        s => s.keys.includes('Ctrl') || s.keys.includes('Alt') || s.keys.includes('Up')
      );
      expect(bindkeyShortcuts.length).toBeGreaterThan(5);
    });

    it('should find alias shortcuts', () => {
      const aliasShortcuts = shortcuts.filter(
        s => s.keys.length === 1 && /^[a-zA-Z]/.test(s.keys[0])
      );
      expect(aliasShortcuts.length).toBeGreaterThan(10);
    });

    it('should find git aliases from fixture', () => {
      const gsAlias = shortcuts.find(s => s.keys[0] === 'gs');
      expect(gsAlias).toBeDefined();
      expect(gsAlias?.description).toBe('git status');
    });

    it('should find history search binding from fixture', () => {
      const historySearch = shortcuts.find(
        s => s.description === 'history-incremental-search-backward' &&
             s.keys.includes('Ctrl') && s.keys.includes('R')
      );
      expect(historySearch).toBeDefined();
    });
  });

  describe('inject()', () => {
    it('should inject a new alias', () => {
      const content = `alias gs='git status'
alias ga='git add'`;
      const newShortcut: ParsedShortcut = {
        title: 'Git branch',
        keys: ['gbr'],
        description: 'git branch -a',
      };

      const result = zshParser.inject(content, newShortcut);

      expect(result).toContain("alias gbr='git branch -a'");
      expect(result).toContain('# Git branch');
    });

    it('should inject a new bindkey', () => {
      const content = `bindkey '^R' history-search
bindkey '^T' fzf-widget`;
      const newShortcut: ParsedShortcut = {
        title: 'Clear screen',
        keys: ['Ctrl', 'L'],
        description: 'clear-screen',
      };

      const result = zshParser.inject(content, newShortcut);

      expect(result).toContain("bindkey '^L' clear-screen");
      expect(result).toContain('# Clear screen');
    });

    it('should insert alias after last alias', () => {
      const content = `# Key bindings
bindkey '^R' history-search

# Aliases
alias gs='git status'
alias ga='git add'

# Other stuff
export EDITOR=vim`;
      const newShortcut: ParsedShortcut = {
        title: 'Git commit',
        keys: ['gc'],
        description: 'git commit',
      };

      const result = zshParser.inject(content, newShortcut);
      const lines = result.split('\n');

      // Find the index of the new alias
      const newAliasIndex = lines.findIndex(l => l.includes('gc='));
      const lastOriginalAliasIndex = lines.findIndex(l => l.includes('ga='));

      expect(newAliasIndex).toBeGreaterThan(lastOriginalAliasIndex);
    });

    it('should insert bindkey after last bindkey', () => {
      const content = `bindkey '^R' history-search
bindkey '^T' fzf-widget

alias gs='git status'`;
      const newShortcut: ParsedShortcut = {
        title: 'Navigate',
        keys: ['Ctrl', 'N'],
        description: 'next-history',
      };

      const result = zshParser.inject(content, newShortcut);
      const lines = result.split('\n');

      const newBindkeyIndex = lines.findIndex(l => l.includes("'^N'"));
      const lastOriginalBindkeyIndex = lines.findIndex(l => l.includes("'^T'"));

      expect(newBindkeyIndex).toBeGreaterThan(lastOriginalBindkeyIndex);
    });

    it('should not add comment if title matches alias name', () => {
      const content = `alias gs='git status'`;
      const newShortcut: ParsedShortcut = {
        title: 'gp',
        keys: ['gp'],
        description: 'git push',
      };

      const result = zshParser.inject(content, newShortcut);

      // Should not have "# gp" comment since title === alias name
      expect(result).not.toMatch(/^# gp$/m);
      expect(result).toContain("alias gp='git push'");
    });

    it('should preserve original content', () => {
      const content = `# My zshrc
export PATH=/usr/local/bin:$PATH

alias gs='git status'`;
      const newShortcut: ParsedShortcut = {
        title: 'Git add',
        keys: ['ga'],
        description: 'git add .',
      };

      const result = zshParser.inject(content, newShortcut);

      expect(result).toContain('# My zshrc');
      expect(result).toContain('export PATH=/usr/local/bin:$PATH');
      expect(result).toContain("alias gs='git status'");
    });
  });

  describe('appId', () => {
    it('should have correct appId', () => {
      expect(zshParser.appId).toBe('zsh');
    });
  });
});
