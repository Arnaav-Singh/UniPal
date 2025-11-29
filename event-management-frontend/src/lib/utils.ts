// Utility helpers shared across the frontend (currently Tailwind class merging).
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Compose conditional class names while resolving Tailwind conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
