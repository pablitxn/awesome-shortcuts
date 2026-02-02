interface KeyCapProps {
  label: string;
  small?: boolean;
}

// Map common modifier names to symbols
const MODIFIER_SYMBOLS: Record<string, string> = {
  Command: "⌘",
  Cmd: "⌘",
  Option: "⌥",
  Alt: "⌥",
  Shift: "⇧",
  Control: "⌃",
  Ctrl: "⌃",
  Enter: "↵",
  Return: "↵",
  Tab: "⇥",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "⎋",
  Esc: "⎋",
  Space: "␣",
  Leader: "␣",
};

const SYMBOL_CHARS = new Set(["⌘", "⌥", "⇧", "⌃", "↵", "⇥", "⌫", "⌦", "⎋", "␣"]);

export function KeyCap({ label, small = false }: KeyCapProps) {
  // Convert modifier names to symbols
  const displayLabel = MODIFIER_SYMBOLS[label] ?? label;
  const isSymbol = SYMBOL_CHARS.has(displayLabel);

  return (
    <kbd
      className={`
        relative inline-flex items-center justify-center
        rounded-md
        bg-gray-100 dark:bg-zinc-800
        border border-gray-300 dark:border-zinc-600
        border-b-2 border-b-gray-400 dark:border-b-zinc-950
        font-mono font-medium
        text-gray-800 dark:text-zinc-200
        select-none cursor-default
        transition-all duration-100
        active:border-b-0 active:translate-y-[2px]
        ${small
          ? "min-w-[26px] h-6 px-1.5 text-xs"
          : "min-w-[36px] h-8 px-2.5 text-sm"
        }
      `}
    >
      <span
        className={`
          relative z-10
          ${isSymbol
            ? small
              ? "text-sm leading-none"
              : "text-base leading-none"
            : ""
          }
        `}
      >
        {displayLabel}
      </span>
    </kbd>
  );
}
