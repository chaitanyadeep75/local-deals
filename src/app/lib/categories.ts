export type CategoryOption = {
  value: string;
  label: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'beauty-salon', label: 'Beauty & Salon' },
  { value: 'spa-wellness', label: 'Spa & Wellness' },
  { value: 'fitness-gym', label: 'Fitness & Gym' },
  { value: 'fashion-apparel', label: 'Fashion & Apparel' },
  { value: 'electronics-gadgets', label: 'Electronics & Gadgets' },
  { value: 'rentals-travel', label: 'Rentals & Travel' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'home-services', label: 'Home Services' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'healthcare', label: 'Healthcare' },
];

export const CATEGORY_FILTERS: CategoryOption[] = [
  { value: 'all', label: 'All' },
  ...CATEGORY_OPTIONS,
];

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  food: 'food',
  salon: 'beauty-salon',
  beauty: 'beauty-salon',
  'beauty-salon': 'beauty-salon',
  spa: 'spa-wellness',
  'spa-wellness': 'spa-wellness',
  gym: 'fitness-gym',
  fitness: 'fitness-gym',
  'fitness-gym': 'fitness-gym',
  fashion: 'fashion-apparel',
  'fashion-apparel': 'fashion-apparel',
  electronics: 'electronics-gadgets',
  'electronics-gadgets': 'electronics-gadgets',
  'rental bikes and cars': 'rentals-travel',
  'rental bikes & cars': 'rentals-travel',
  'rentals-travel': 'rentals-travel',
  shopping: 'shopping',
  services: 'home-services',
  'home-services': 'home-services',
  auto: 'automotive',
  automobile: 'automotive',
  automotive: 'automotive',
  pub: 'entertainment',
  entertainment: 'entertainment',
  healthcare: 'healthcare',
};

export function normalizeCategory(category: string | null | undefined): string {
  if (!category) return '';
  const key = category.trim().toLowerCase();
  return LEGACY_CATEGORY_MAP[key] || key;
}

export function categoryMatchesFilter(category: string | null | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  return normalizeCategory(category) === filter;
}

export function getCategoryLabel(category: string | null | undefined): string {
  const normalized = normalizeCategory(category);
  const matched = CATEGORY_OPTIONS.find((c) => c.value === normalized);
  if (matched) return matched.label;
  return (category || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
