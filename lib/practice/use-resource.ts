"use client";
/* eslint-disable react-hooks/set-state-in-effect -- reset resource state when its identity changes. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePracticeResource<T>(load: (signal: AbortSignal) => Promise<T>, running?: (value: T) => boolean) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const identity = useRef(load);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    if (identity.current !== load) { setData(undefined); identity.current = load; }
    setError(''); setLoading(true);
    async function read() {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const next = await load(controller.signal);
        if (controller.signal.aborted) return;
        setData(next); setError('');
        if (running?.(next) && !document.hidden) timer = setTimeout(read, 1000);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '读取失败，请重试。');
      } finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    }
    function visibility() {
      clearTimeout(timer);
      if (!document.hidden) void read();
    }
    void read(); document.addEventListener('visibilitychange', visibility);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [load, running, revision]);
  return { data, error, loading, refresh };
}
