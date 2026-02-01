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
        rounded-md border border-gray-300 dark:border-gray-600
        bg-gradient-to-b from-gray-50 to-gray-100
        dark:from-gray-700 dark:to-gray-800
        font-mono font-medium
        shadow-[0_2px_0_0_rgb(0,0,0,0.1),inset_0_1px_0_0_rgb(255,255,255,0.3)]
        dark:shadow-[0_2px_0_0_rgb(0,0,0,0.3),inset_0_1px_0_0_rgb(255,255,255,0.05)]
        text-gray-700 dark:text-gray-200
        select-none
        transition-all duration-100
        active:shadow-none active:translate-y-[2px]
        ${small ? "min-w-[26px] h-6 px-1.5 text-xs" : "min-w-[36px] h-8 px-2.5 text-sm"}
      `}
    >
      <span
        className={
          isSymbol
            ? small
              ? "text-sm leading-none"
              : "text-base leading-none"
            : ""
        }
      >
        {displayLabel}
      </span>
    </kbd>
  );
}
