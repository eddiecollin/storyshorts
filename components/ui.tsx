import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-200">{label}</span>
      {children}
      {hint ? <span className="mt-2 block text-xs leading-5 text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = {
    primary: "bg-white text-neutral-950 hover:bg-sky-100 disabled:bg-neutral-500 disabled:text-neutral-900",
    secondary: "border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1] disabled:text-neutral-500",
    ghost: "text-neutral-300 hover:bg-white/[0.08] disabled:text-neutral-600"
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-sky-300/70 focus:ring-2 focus:ring-sky-300/15";
