import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange, icon, error = false, className = "", ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`block w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            icon ? "pl-10" : ""
          } ${
            error
              ? "border-error focus:ring-error"
              : "border-gray-200 focus:ring-primary dark:border-gray-700"
          } ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
