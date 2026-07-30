import type { User } from '@supabase/supabase-js';

export function isBusinessRole(user: Pick<User, 'user_metadata'> | null | undefined): boolean {
  return user?.user_metadata?.role === 'business';
}
