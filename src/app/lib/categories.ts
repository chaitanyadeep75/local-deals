export type CategoryOption = {
  value: string;
  label: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'food',                label: 'Food & Dining' },
  { value: 'restaurants-cafes',   label: 'Restaurants & Cafes' },
  { value: 'grocery',             label: 'Grocery & Supermarket' },
  { value: 'beauty-salon',        label: 'Beauty & Salon' },
  { value: 'spa-wellness',        label: 'Spa & Wellness' },
  { value: 'fitness-gym',         label: 'Fitness & Gym' },
  { value: 'fashion-apparel',     label: 'Fashion & Apparel' },
  { value: 'electronics-gadgets', label: 'Electronics & Gadgets' },
  { value: 'rentals-travel',      label: 'Rentals & Travel' },
  { value: 'hotels-resorts',      label: 'Hotels & Resorts' },
  { value: 'education',           label: 'Education & Coaching' },
  { value: 'healthcare',          label: 'Healthcare' },
  { value: 'pharmacy',            label: 'Pharmacy & Medical' },
  { value: 'automotive',          label: 'Automotive & Mechanic' },
  { value: 'home-services',       label: 'Home Services' },
  { value: 'shopping',            label: 'Shopping' },
  { value: 'entertainment',       label: 'Entertainment' },
  { value: 'events-parties',      label: 'Events & Parties' },
  { value: 'pets',                label: 'Pets & Pet Care' },
  { value: 'photography',         label: 'Photography & Studio' },
  { value: 'laundry-cleaning',    label: 'Laundry & Cleaning' },
  { value: 'real-estate',         label: 'Real Estate & Rentals' },
];

/** Emoji + accent color per category — used in UI pills, cards, maps */
export const CATEGORY_META: Record<string, { emoji: string; color: string; bg: string }> = {
  'food':                { emoji: '🍽️',  color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/30' },
  'restaurants-cafes':   { emoji: '☕',   color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30' },
  'grocery':             { emoji: '🛒',  color: 'text-green-400',   bg: 'bg-green-500/15 border-green-500/30' },
  'beauty-salon':        { emoji: '💇',  color: 'text-pink-400',    bg: 'bg-pink-500/15 border-pink-500/30' },
  'spa-wellness':        { emoji: '🧘',  color: 'text-teal-400',    bg: 'bg-teal-500/15 border-teal-500/30' },
  'fitness-gym':         { emoji: '🏋️',  color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30' },
  'fashion-apparel':     { emoji: '👗',  color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15 border-fuchsia-500/30' },
  'electronics-gadgets': { emoji: '📱',  color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/30' },
  'rentals-travel':      { emoji: '✈️',  color: 'text-sky-400',     bg: 'bg-sky-500/15 border-sky-500/30' },
  'hotels-resorts':      { emoji: '🏨',  color: 'text-indigo-400',  bg: 'bg-indigo-500/15 border-indigo-500/30' },
  'education':           { emoji: '📚',  color: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/30' },
  'healthcare':          { emoji: '🏥',  color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  'pharmacy':            { emoji: '💊',  color: 'text-cyan-400',    bg: 'bg-cyan-500/15 border-cyan-500/30' },
  'automotive':          { emoji: '🔧',  color: 'text-slate-300',   bg: 'bg-slate-500/15 border-slate-500/30' },
  'home-services':       { emoji: '🏠',  color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/30' },
  'shopping':            { emoji: '🛍️',  color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/30' },
  'entertainment':       { emoji: '🎬',  color: 'text-purple-400',  bg: 'bg-purple-500/15 border-purple-500/30' },
  'events-parties':      { emoji: '🎉',  color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30' },
  'pets':                { emoji: '🐾',  color: 'text-lime-400',    bg: 'bg-lime-500/15 border-lime-500/30' },
  'photography':         { emoji: '📷',  color: 'text-neutral-300', bg: 'bg-neutral-500/15 border-neutral-500/30' },
  'laundry-cleaning':    { emoji: '🧺',  color: 'text-sky-300',     bg: 'bg-sky-500/15 border-sky-500/30' },
  'real-estate':         { emoji: '🏗️',  color: 'text-orange-300',  bg: 'bg-orange-500/15 border-orange-500/30' },
};

export function getCategoryMeta(category: string | null | undefined) {
  const normalized = normalizeCategory(category);
  return CATEGORY_META[normalized] ?? { emoji: '🏷️', color: 'text-slate-400', bg: 'bg-slate-500/15 border-slate-500/30' };
}

export const CATEGORY_FILTERS: CategoryOption[] = [
  { value: 'all', label: 'All' },
  ...CATEGORY_OPTIONS,
];

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  food:                    'food',
  restaurant:              'restaurants-cafes',
  cafe:                    'restaurants-cafes',
  'restaurants-cafes':     'restaurants-cafes',
  grocery:                 'grocery',
  supermarket:             'grocery',
  salon:                   'beauty-salon',
  beauty:                  'beauty-salon',
  'beauty-salon':          'beauty-salon',
  spa:                     'spa-wellness',
  'spa-wellness':          'spa-wellness',
  gym:                     'fitness-gym',
  fitness:                 'fitness-gym',
  'fitness-gym':           'fitness-gym',
  fashion:                 'fashion-apparel',
  'fashion-apparel':       'fashion-apparel',
  electronics:             'electronics-gadgets',
  'electronics-gadgets':   'electronics-gadgets',
  'rental bikes and cars': 'rentals-travel',
  'rental bikes & cars':   'rentals-travel',
  'rentals-travel':        'rentals-travel',
  hotel:                   'hotels-resorts',
  resort:                  'hotels-resorts',
  'hotels-resorts':        'hotels-resorts',
  school:                  'education',
  college:                 'education',
  coaching:                'education',
  tuition:                 'education',
  education:               'education',
  shopping:                'shopping',
  services:                'home-services',
  'home-services':         'home-services',
  auto:                    'automotive',
  automobile:              'automotive',
  mechanic:                'automotive',
  automotive:              'automotive',
  healthcare:              'healthcare',
  hospital:                'healthcare',
  clinic:                  'healthcare',
  pharmacy:                'pharmacy',
  medical:                 'pharmacy',
  chemist:                 'pharmacy',
  pub:                     'entertainment',
  entertainment:           'entertainment',
  events:                  'events-parties',
  'events-parties':        'events-parties',
  party:                   'events-parties',
  pets:                    'pets',
  'pet care':              'pets',
  photography:             'photography',
  photographer:            'photography',
  laundry:                 'laundry-cleaning',
  'laundry-cleaning':      'laundry-cleaning',
  'real-estate':           'real-estate',
  property:                'real-estate',
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
