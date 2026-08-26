import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@core/index.ts";
import { fetchSession, openStream } from "../lib/api.ts";

/**
 * Loads the session from the server and keeps it live: re-fetches (debounced)
 * whenever the server reports a file change over SSE.
 */
export function useSession(): { session: Session | null; connected: boolean; error: string | null } {
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      setSession(await fetchSession());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const reloadDebounced = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(reload, 150);
  }, [reload]);

  useEffect(() => {
    void reload();
    const close = openStream({
      onOpen: () => setConnected(true),
      onError: () => setConnected(false),
      onChange: reloadDebounced,
    });
    return () => {
      close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reload, reloadDebounced]);

  return { session, connected, error };
}
