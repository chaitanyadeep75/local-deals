export type CategoryOption = { value: string; label: string };

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

export function getCategoryEmoji(value: string): string {
  const map: Record<string, string> = {
    food: '🍔', 'beauty-salon': '💄', 'spa-wellness': '🧖',
    'fitness-gym': '🏋️', 'fashion-apparel': '👗', 'electronics-gadgets': '📱',
    'rentals-travel': '✈️', shopping: '🛍️', 'home-services': '🏠',
    automotive: '🚗', entertainment: '🎭', healthcare: '🏥',
  };
  return map[value] || '🏷️';
}
