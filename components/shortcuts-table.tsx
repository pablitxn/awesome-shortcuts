"use client";

import { useMemo } from "react";
import { Search, Keyboard, Sparkles } from "lucide-react";
import { KeyCap } from "./key-cap";
import type { Shortcut } from "@/lib/types";

interface ShortcutsTableProps {
  shortcuts: Shortcut[];
  selectedCategory: string;
  searchQuery: string;
}

// Category color mapping
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  nvim: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30"
  },
  tmux: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30"
  },
  vscode: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30"
  },
  all: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30"
  },
};

export function ShortcutsTable({
  shortcuts,
  selectedCategory,
  searchQuery,
}: ShortcutsTableProps) {
  const filteredShortcuts = useMemo(() => {
    return shortcuts.filter((shortcut) => {
      const matchesCategory =
        selectedCategory === "all" || shortcut.app_id === selectedCategory;

      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;

      const matchesSearch =
        shortcut.title.toLowerCase().includes(query) ||
        shortcut.keys.join(" ").toLowerCase().includes(query) ||
        (shortcut.description?.toLowerCase().includes(query) ?? false);

      return matchesCategory && matchesSearch;
    });
  }, [shortcuts, selectedCategory, searchQuery]);

  // Empty state when no shortcuts exist at all
  if (shortcuts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 blur-2xl opacity-30" />
          <div className="relative rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 p-6 backdrop-blur-sm border border-indigo-500/20">
            <Keyboard className="h-12 w-12 text-indigo-500 dark:text-indigo-400" />
          </div>
        </div>
        <h2 className="text-h4 mb-2 text-foreground">No shortcuts yet</h2>
        <p className="max-w-md text-small text-gray-500 dark:text-gray-400">
          Configure your config paths in Settings to start importing your
          keyboard shortcuts from Neovim, Tmux, VS Code, and more.
        </p>
      </div>
    );
  }

  // Empty state when no results match filters
  if (filteredShortcuts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 blur-2xl opacity-20" />
          <div className="relative rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 backdrop-blur-sm border border-amber-500/20">
            <Search className="h-12 w-12 text-amber-500 dark:text-amber-400" />
          </div>
        </div>
        <h2 className="text-h4 mb-2 text-foreground">No shortcuts found</h2>
        <p className="max-w-md text-small text-gray-500 dark:text-gray-400">
          Try adjusting your search query or selecting a different category.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredShortcuts.map((shortcut, index) => {
        const colors = CATEGORY_COLORS[shortcut.app_id] || CATEGORY_COLORS.all;

        return (
          <div
            key={shortcut.id}
            tabIndex={0}
            className={`
              group relative
              flex items-center gap-6 
              rounded-xl
              bg-card-bg border border-card-border
              px-6 py-4
              cursor-default
              transition-all duration-200
              hover:shadow-md
              focus:outline-none focus:ring-2 focus:ring-primary/50
            `}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                const nextRow = e.currentTarget.nextElementSibling as HTMLElement;
                nextRow?.focus();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prevRow = e.currentTarget.previousElementSibling as HTMLElement;
                prevRow?.focus();
              }
            }}
          >

            {/* Category badge */}
            <div className={`
              shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider
              ${colors.bg} ${colors.text} border ${colors.border}
            `}>
              {shortcut.app_id}
            </div>

            {/* Shortcut info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {shortcut.title}
              </h3>
              {shortcut.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {shortcut.description}
                </p>
              )}
            </div>

            {/* Keys */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {shortcut.keys.map((key, keyIndex) => (
                <span key={keyIndex} className="flex items-center gap-1">
                  <KeyCap label={key} small />
                  {keyIndex < shortcut.keys.length - 1 && (
                    <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer with count */}
      <div className="flex items-center justify-between px-4 py-3 mt-6">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            Showing <span className="font-semibold text-foreground">{filteredShortcuts.length}</span> of{" "}
            <span className="font-semibold text-foreground">{shortcuts.length}</span> shortcuts
          </span>
        </div>
      </div>
    </div>
  );
}
