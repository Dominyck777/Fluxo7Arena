import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

// Deterministic color per court name (not user-configurable)
const COURT_PALETTE = [
  '#3B82F6', // blue-500
  '#22C55E', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F43F5E', // rose-500
  '#10B981', // green-500
  '#A855F7', // purple-500
  '#EAB308', // yellow-500
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getCourtColor(name) {
  if (!name) return '#94A3B8'; // slate-400 fallback
  const idx = hashString(String(name)) % COURT_PALETTE.length;
  return COURT_PALETTE[idx];
}