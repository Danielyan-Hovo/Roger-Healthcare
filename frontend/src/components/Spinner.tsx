import clsx from "clsx";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const dim = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span
      className={clsx(
        "inline-block animate-spin rounded-full border-2 border-current border-r-transparent",
        dim,
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
