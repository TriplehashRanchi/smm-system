"use client";
import { useEffect, useRef } from "react";

// Runs `callback` whenever the workspace learns that the other side changed something (see the poller in workspace.js).
export function useLiveRefresh(callback) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    const listen = (event) => latest.current(event.detail);
    window.addEventListener("workspace-updates", listen);
    return () => window.removeEventListener("workspace-updates", listen);
  }, []);
}
