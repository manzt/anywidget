export type ButtonSize = "xs" | "sm" | "lg";

export const buttonSizeClass: Record<ButtonSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  lg: "text-lg",
};

export const buttonClass =
  "rounded bg-secondary-600 px-4 py-2 text-white shadow hover:bg-secondary-800";
