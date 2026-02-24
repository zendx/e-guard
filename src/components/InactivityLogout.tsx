"use client";

import { useEffect, useRef } from "react";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

type InactivityLogoutProps = {
  redirectTo?: string;
};

export default function InactivityLogout({
  redirectTo = "/auth?mode=login",
}: InactivityLogoutProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedOutRef = useRef(false);

  useEffect(() => {
    const clearExistingTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };

    const logoutForInactivity = async () => {
      if (hasLoggedOutRef.current) {
        return;
      }
      hasLoggedOutRef.current = true;
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          keepalive: true,
        });
      } finally {
        window.location.href = redirectTo;
      }
    };

    const resetTimer = () => {
      if (hasLoggedOutRef.current) {
        return;
      }
      clearExistingTimer();
      timerRef.current = setTimeout(() => {
        void logoutForInactivity();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    document.addEventListener("visibilitychange", resetTimer);
    resetTimer();

    return () => {
      clearExistingTimer();
      for (const eventName of events) {
        window.removeEventListener(eventName, resetTimer);
      }
      document.removeEventListener("visibilitychange", resetTimer);
    };
  }, [redirectTo]);

  return null;
}
