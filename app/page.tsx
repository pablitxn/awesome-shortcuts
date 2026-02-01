"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 px-8 dark:border-gray-800">
          <h1 className="text-h3 text-foreground">
            {activeCategory === "all"
              ? "All Shortcuts"
              : activeCategory.charAt(0).toUpperCase() +
                activeCategory.slice(1)}
          </h1>

          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700"
            />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          {/* Empty State */}
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-h4 mb-2 text-foreground">No shortcuts yet</h2>
            <p className="max-w-md text-small text-gray-500 dark:text-gray-400">
              Configure your config paths in Settings to start importing your
              keyboard shortcuts from Neovim, Tmux, VS Code, and more.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
