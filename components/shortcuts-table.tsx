"use client";

import { useMemo } from "react";
import { Search, Keyboard } from "lucide-react";
import { KeyCap } from "./key-cap";
import type { Shortcut } from "@/lib/types";

interface ShortcutsTableProps {
  shortcuts: Shortcut[];
  selectedCategory: string;
  searchQuery: string;
}

export function ShortcutsTable({
  shortcuts,
  selectedCategory,
  searchQuery,
}: ShortcutsTableProps) {
  const filteredShortcuts = useMemo(() => {
    return shortcuts.filter((shortcut) => {
      // Filter by category
      const matchesCategory =
        selectedCategory === "all" || shortcut.app_id === selectedCategory;

      // Filter by search query
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
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
          <Keyboard className="h-8 w-8 text-gray-400" />
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
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
          <Search className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-h4 mb-2 text-foreground">No shortcuts found</h2>
        <p className="max-w-md text-small text-gray-500 dark:text-gray-400">
          Try adjusting your search query or selecting a different category.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-card-border bg-card-bg shadow-sm">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-6 py-3 text-tiny font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Name
              </th>
              <th className="px-6 py-3 text-tiny font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Keys
              </th>
              <th className="hidden px-6 py-3 text-tiny font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                Description
              </th>
              <th className="hidden px-6 py-3 text-tiny font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredShortcuts.map((shortcut, index) => (
              <tr
                key={shortcut.id}
                tabIndex={0}
                className="group cursor-default transition-colors hover:bg-gray-50 focus:bg-primary-light focus:outline-none dark:hover:bg-gray-800/50 dark:focus:bg-primary-light/10"
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
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary">
                    {shortcut.title}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex} className="flex items-center gap-1">
                        <KeyCap label={key} small />
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-xs font-bold text-gray-400">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="hidden px-6 py-4 md:table-cell">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {shortcut.description || "—"}
                  </span>
                </td>
                <td className="hidden px-6 py-4 lg:table-cell">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {shortcut.app_id}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-tiny text-gray-500 dark:text-gray-400">
          Showing {filteredShortcuts.length} of {shortcuts.length} shortcuts
        </p>
      </div>
    </div>
  );
}
