import { cn } from "@/lib/utils";
import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "order";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: "bg-accent text-black hover:bg-accent-strong active:scale-[0.98]",
  secondary:
    "bg-surface-2 text-text-primary border border-border-soft hover:border-accent/40 active:scale-[0.98]",
  ghost: "bg-transparent text-text-primary hover:bg-white/5 active:scale-[0.98]",
  danger: "bg-status-cancelled/15 text-status-cancelled hover:bg-status-cancelled/25",
  order:
    "bg-gradient-to-r from-accent-order-from to-accent-order-to text-white shadow-[0_4px_20px_-2px_var(--accent-order-glow)] hover:shadow-[0_6px_24px_-2px_var(--accent-order-glow)] hover:brightness-105 active:scale-[0.98]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm rounded-xl",
  md: "px-5 py-3 text-sm rounded-2xl",
  lg: "px-6 py-4 text-base rounded-2xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  icon,
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
