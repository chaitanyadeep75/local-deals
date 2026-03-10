export const FREE_POSTING_ENABLED = true;
export const DEFAULT_CURRENCY = 'INR';
export const BOOST_PLANS_CONFIG_KEY = 'boost_plans';

export type BoostPlan = {
  days: number;
  price: number;
  label: string;
};

export const BOOST_PLANS: BoostPlan[] = [
  { days: 3, price: 149, label: 'Boost 3 days' },
  { days: 7, price: 299, label: 'Boost 7 days' },
];

export function getDefaultBoostPlans(): BoostPlan[] {
  return BOOST_PLANS.map((plan) => ({ ...plan }));
}

export function parseBoostPlans(input: unknown): BoostPlan[] {
  if (!Array.isArray(input)) return getDefaultBoostPlans();
  const parsed = input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as { days?: unknown; price?: unknown; label?: unknown };
      const days = Number(candidate.days);
      const price = Number(candidate.price);
      if (!Number.isFinite(days) || !Number.isFinite(price) || days <= 0 || price < 0) return null;
      const label = typeof candidate.label === 'string' && candidate.label.trim()
        ? candidate.label.trim()
        : `Boost ${days} days`;
      return { days: Math.round(days), price: Math.round(price), label };
    })
    .filter((item): item is BoostPlan => !!item)
    .sort((a, b) => a.days - b.days);

  return parsed.length ? parsed : getDefaultBoostPlans();
}

export function getBoostPlan(days: number): BoostPlan | null {
  return BOOST_PLANS.find((plan) => plan.days === days) || null;
}

export function getBoostPlanFromList(plans: BoostPlan[], days: number): BoostPlan | null {
  return plans.find((plan) => plan.days === days) || null;
}
