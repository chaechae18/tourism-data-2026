"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "./client";

/**
 * Load one home endpoint and keep its status.
 *
 * There is deliberately no fallback data: when the server is unreachable the
 * caller renders an error state instead of stale copy, so a dead backend
 * cannot masquerade as a working screen.
 */
export default function useApiResource(path, { lang } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ data: null, error: null, loading: true });

    fetchJson(path, { lang, signal: controller.signal })
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!active || error?.name === "AbortError") return;
        setState({ data: null, error, loading: false });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [path, lang, attempt]);

  return { ...state, retry };
}
