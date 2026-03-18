import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}

export function Button({ 
  variant = "primary", 
  children, 
  className,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2.5 rounded-lg transition-colors w-full",
        variant === "primary" && "bg-primary text-white hover:bg-primary/90",
        variant === "secondary" && "bg-gray-100 text-gray-900 hover:bg-gray-200",
        variant === "ghost" && "text-gray-600 hover:bg-gray-100",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
