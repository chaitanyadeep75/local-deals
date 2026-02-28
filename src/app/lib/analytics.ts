import { supabase } from '@/app/lib/supabase';

type EventPayload = Record<string, unknown>;

const FALLBACK_KEY = 'ld_event_buffer';

function pushLocalFallback(entry: { event: string; payload: EventPayload; path: string | null; ts: string }) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<{ event: string; payload: EventPayload; path: string | null; ts: string }>) : [];
    const next = [entry, ...parsed].slice(0, 100);
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(next));
  } catch {
    // Best-effort fallback only.
  }
}

export async function trackEvent(event: string, payload: EventPayload = {}) {
  const entry = {
    event,
    payload,
    path: typeof window !== 'undefined' ? window.location.pathname : null,
    ts: new Date().toISOString(),
  };

  try {
    const inserted = await supabase
      .from('analytics_events')
      .insert({
        event_name: entry.event,
        event_payload: entry.payload,
        page_path: entry.path,
        created_at: entry.ts,
      });

    if (!inserted.error) return;

    // Backward-compatible fallback if the first table does not exist yet.
    const backup = await supabase
      .from('event_logs')
      .insert({
        event_name: entry.event,
        payload: entry.payload,
        page_path: entry.path,
        created_at: entry.ts,
      });

    if (backup.error) pushLocalFallback(entry);
  } catch {
    pushLocalFallback(entry);
  }
}
