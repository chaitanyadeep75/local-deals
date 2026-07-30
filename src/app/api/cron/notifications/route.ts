import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const runtime = 'nodejs';

type Results = { enqueued: number; sent: number; failed: number };

function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function parsePrice(value: unknown): number | null {
  if (!value) return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

async function alreadyQueued(db: SupabaseClient, userId: string, dealId: number, type: string): Promise<boolean> {
  const { data } = await db
    .from('notification_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('deal_id', dealId)
    .eq('type', type)
    .maybeSingle();
  return !!data;
}

/** Deals a user has saved and are expiring today, for users who want that alert. */
async function enqueueEndingSoon(db: SupabaseClient, results: Results) {
  const { data: saved } = await db.from('saved_deals').select('user_id, deal_id');
  if (!saved?.length) return;

  const dealIds = [...new Set(saved.map((s) => s.deal_id))];
  const { data: deals } = await db.from('deals').select('*').in('id', dealIds);
  const dealsById = new Map((deals || []).map((d) => [d.id, d]));

  const today = new Date().toISOString().split('T')[0];
  const endingToday = saved.filter((s) => {
    const d = dealsById.get(s.deal_id);
    return d && d.valid_till_date === today && (!d.status || d.status === 'active');
  });
  if (!endingToday.length) return;

  const userIds = [...new Set(endingToday.map((s) => s.user_id))];
  const { data: prefs } = await db.from('notification_preferences').select('user_id, ending_soon_enabled').in('user_id', userIds);
  const prefByUser = new Map((prefs || []).map((p) => [p.user_id, p]));

  for (const s of endingToday) {
    const pref = prefByUser.get(s.user_id);
    if (pref && pref.ending_soon_enabled === false) continue;
    const deal = dealsById.get(s.deal_id);
    const type = `ending_soon_${deal.valid_till_date}`;
    if (await alreadyQueued(db, s.user_id, s.deal_id, type)) continue;

    await db.from('notification_queue').insert({
      user_id: s.user_id,
      deal_id: s.deal_id,
      channel: 'push',
      type,
      title: 'Ending today!',
      body: `${deal.title} ends today — grab it before it's gone.`,
      payload: { url: `/deal/${s.deal_id}` },
    });
    results.enqueued++;
  }
}

/** Deals a user has saved whose price has dropped since we last checked. */
async function enqueuePriceDrops(db: SupabaseClient, results: Results) {
  const { data: saved } = await db.from('saved_deals').select('user_id, deal_id');
  if (!saved?.length) return;

  const dealIds = [...new Set(saved.map((s) => s.deal_id))];
  const { data: deals } = await db.from('deals').select('*').in('id', dealIds);

  const userIds = [...new Set(saved.map((s) => s.user_id))];
  const { data: prefs } = await db.from('notification_preferences').select('user_id, price_drop_enabled').in('user_id', userIds);
  const prefByUser = new Map((prefs || []).map((p) => [p.user_id, p]));

  for (const deal of deals || []) {
    const current = parsePrice(deal.offer_price);
    if (current === null) continue;

    const last = deal.last_notified_price;
    if (last === null || last === undefined) {
      // First time we've seen this deal — establish a baseline, don't notify yet.
      await db.from('deals').update({ last_notified_price: current }).eq('id', deal.id);
      continue;
    }
    if (current >= Number(last)) continue;

    const savers = saved.filter((s) => s.deal_id === deal.id);
    const type = `price_drop_${current}`;
    for (const s of savers) {
      const pref = prefByUser.get(s.user_id);
      if (pref && pref.price_drop_enabled === false) continue;
      if (await alreadyQueued(db, s.user_id, deal.id, type)) continue;

      await db.from('notification_queue').insert({
        user_id: s.user_id,
        deal_id: deal.id,
        channel: 'push',
        type,
        title: 'Price drop!',
        body: `${deal.title} just dropped to ${deal.offer_price}.`,
        payload: { url: `/deal/${deal.id}` },
      });
      results.enqueued++;
    }
    await db.from('deals').update({ last_notified_price: current }).eq('id', deal.id);
  }
}

/** New deals in an area/category a user has shown interest in via saved deals. */
async function enqueueNewNearby(db: SupabaseClient, results: Results) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: newDeals } = await db.from('deals').select('*').gte('created_at', since);
  const candidates = (newDeals || []).filter((d) => (!d.status || d.status === 'active') && (d.city || d.area));
  if (!candidates.length) return;

  const { data: saved } = await db.from('saved_deals').select('user_id, deal_id');
  if (!saved?.length) return;

  const savedDealIds = [...new Set(saved.map((s) => s.deal_id))];
  const { data: savedDealRows } = await db.from('deals').select('id, city, area').in('id', savedDealIds);
  const savedDealById = new Map((savedDealRows || []).map((d) => [d.id, d]));

  const userAreas = new Map<string, Set<string>>();
  for (const s of saved) {
    const d = savedDealById.get(s.deal_id);
    if (!d) continue;
    const key = `${d.city || ''}|${d.area || ''}`;
    if (!userAreas.has(s.user_id)) userAreas.set(s.user_id, new Set());
    userAreas.get(s.user_id)!.add(key);
  }

  const userIds = [...userAreas.keys()];
  if (!userIds.length) return;
  const { data: prefs } = await db.from('notification_preferences').select('user_id, new_nearby_enabled').in('user_id', userIds);
  const prefByUser = new Map((prefs || []).map((p) => [p.user_id, p]));

  for (const deal of candidates) {
    const key = `${deal.city || ''}|${deal.area || ''}`;
    for (const [userId, areas] of userAreas) {
      if (!areas.has(key)) continue;
      const pref = prefByUser.get(userId);
      if (pref && pref.new_nearby_enabled === false) continue;
      const type = `new_nearby_${deal.id}`;
      if (await alreadyQueued(db, userId, deal.id, type)) continue;

      await db.from('notification_queue').insert({
        user_id: userId,
        deal_id: deal.id,
        channel: 'push',
        type,
        title: 'New deal nearby',
        body: `${deal.title} just went live${deal.area ? ` in ${deal.area}` : ''}.`,
        payload: { url: `/deal/${deal.id}` },
      });
      results.enqueued++;
    }
  }
}

/** Sends every pending push notification and marks the outcome. */
async function drainQueue(db: SupabaseClient, results: Results) {
  const { data: pending } = await db
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('channel', 'push')
    .lte('scheduled_for', new Date().toISOString())
    .limit(200);
  if (!pending?.length) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@localdeals.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', userIds);
  const subsByUser = new Map<string, typeof subs>();
  for (const s of subs || []) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id)!.push(s);
  }

  for (const n of pending) {
    const subscriptions = subsByUser.get(n.user_id) || [];
    if (!subscriptions.length) {
      await db.from('notification_queue').update({ status: 'no_subscription', sent_at: new Date().toISOString() }).eq('id', n.id);
      continue;
    }

    let anySent = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.payload?.url || '/', tag: n.type })
        );
        anySent = true;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    await db.from('notification_queue').update({
      status: anySent ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    }).eq('id', n.id);

    if (anySent) results.sent++;
    else results.failed++;
  }
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 });
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'VAPID keys are not configured' }, { status: 500 });
  }

  const db = adminClient();
  const results: Results = { enqueued: 0, sent: 0, failed: 0 };

  try {
    await enqueueEndingSoon(db, results);
    await enqueuePriceDrops(db, results);
    await enqueueNewNearby(db, results);
    await drainQueue(db, results);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), ...results }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...results });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Some schedulers (Vercel Cron, cron-job.org) only send GET.
export async function GET(req: NextRequest) {
  return handle(req);
}
