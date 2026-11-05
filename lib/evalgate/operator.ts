import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * True only for accounts listed in public.operators (added from the SQL editor).
 * Fails closed: any error means "not an operator".
 */
export const isOperator = cache(async (): Promise<boolean> => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("is_operator");
    return !error && data === true;
  } catch {
    return false;
  }
});
