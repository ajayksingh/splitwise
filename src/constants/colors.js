export const COLORS = {
  // Primary — Teal (matches Figma)
  primary: '#00d4aa',
  primaryDark: '#00b894',
  primaryLight: 'rgba(0,212,170,0.12)',
  primaryGradient: ['#00d4aa', '#00b894'],

  // Semantic
  secondary: '#a55eea',
  accent: '#ffd93d',
  success: '#00d4aa',
  danger: '#ff4757',
  warning: '#ffd93d',
  info: '#4fc3f7',
  positive: '#00d4aa',
  negative: '#ff6b6b',
  neutral: '#71717a',

  // Surface / Layout — Dark theme (matches Figma)
  background: '#0a0a0f',
  white: '#1a1a24',
  black: '#ffffff',
  card: '#1a1a24',
  border: 'rgba(255,255,255,0.08)',
  shadow: 'rgba(0,212,170,0.15)',
  overlay: 'rgba(0,0,0,0.7)',

  // Typography
  text: '#ffffff',
  textLight: '#a1a1aa',
  textMuted: '#52525b',
};

export const CATEGORIES = [
  { id: 'food',          label: 'Food & Drink',   icon: 'restaurant',    emoji: '🍔', color: '#F43F5E' },
  { id: 'housing',       label: 'Housing',         icon: 'home',          emoji: '🏠', color: '#3B82F6' },
  { id: 'transport',     label: 'Transport',       icon: 'car',           emoji: '🚗', color: '#F59E0B' },
  { id: 'entertainment', label: 'Entertainment',   icon: 'musical-notes', emoji: '🎬', color: '#8B5CF6' },
  { id: 'shopping',      label: 'Shopping',        icon: 'cart',          emoji: '🛍️', color: '#EC4899' },
  { id: 'utilities',     label: 'Utilities',       icon: 'flash',         emoji: '💡', color: '#F97316' },
  { id: 'health',        label: 'Health',          icon: 'medical',       emoji: '💊', color: '#10B981' },
  { id: 'travel',        label: 'Travel',          icon: 'airplane',      emoji: '✈️', color: '#6366F1' },
  { id: 'general',       label: 'General',         icon: 'receipt',       emoji: '📝', color: '#64748B' },
];

export const GROUP_TYPES = [
  { id: 'home',   label: 'Home',   icon: 'home',     emoji: '🏠' },
  { id: 'trip',   label: 'Trip',   icon: 'airplane', emoji: '✈️' },
  { id: 'couple', label: 'Couple', icon: 'heart',    emoji: '💑' },
  { id: 'other',  label: 'Other',  icon: 'people',   emoji: '👥' },
];
