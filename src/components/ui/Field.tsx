import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CONTROL_BASE =
  "w-full rounded-xl border border-hairline bg-surface-1/80 px-3.5 text-body text-ink transition-colors duration-200 placeholder:text-ink-4 hover:border-white/20 focus:border-brand-orange/60 focus:outline-none focus:ring-2 focus:ring-brand-orange/25";

export const controlClass = (className?: string): string => cn(CONTROL_BASE, "h-11", className);

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-label font-semibold uppercase text-ink-3">
        {label}
      </label>
      {children}
      {hint && <p className="text-small text-ink-4">{hint}</p>}
    </div>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  group?: string;
}

interface SelectProps<T extends string> {
  id: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  className,
}: SelectProps<T>) {
  const groups = options.some((option) => option.group)
    ? [...new Set(options.map((option) => option.group).filter((g): g is string => Boolean(g)))]
    : null;

  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={controlClass(cn("appearance-none pr-10", className))}
      >
        {groups
          ? groups.map((group) => (
              <optgroup key={group} label={group} className="bg-surface-2 text-ink">
                {options
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <option key={option.value} value={option.value} className="bg-surface-2 text-ink">
                      {option.label}
                    </option>
                  ))}
              </optgroup>
            ))
          : options.map((option) => (
              <option key={option.value} value={option.value} className="bg-surface-2 text-ink">
                {option.label}
              </option>
            ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        aria-hidden="true"
      />
    </div>
  );
}

interface TextInputProps {
  id: string;
  name?: string;
  type?: "text" | "email" | "date" | "number" | "tel";
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  autoComplete?: string;
  className?: string;
}

export function TextInput({
  id,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  min,
  max,
  autoComplete,
  className,
}: TextInputProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      autoComplete={autoComplete}
      className={controlClass(cn("[color-scheme:dark]", className))}
    />
  );
}

interface TextAreaProps {
  id: string;
  name?: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function TextArea({
  id,
  name,
  rows = 4,
  placeholder,
  required = false,
  className,
}: TextAreaProps) {
  return (
    <textarea
      id={id}
      name={name}
      rows={rows}
      placeholder={placeholder}
      required={required}
      className={cn(CONTROL_BASE, "resize-none py-3", className)}
    />
  );
}
