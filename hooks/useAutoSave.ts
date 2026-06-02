"use client";

import { useEffect, useRef } from "react";

import { saveDraft, type ComposerScope } from "@/lib/composer/draftStorage";

interface UseAutoSaveOpts {
  body: string;
  scope: ComposerScope;
  userId: string | null;
  debounceMs?: number;
}

export function useAutoSave({
  body,
  scope,
  userId,
  debounceMs = 3000,
}: UseAutoSaveOpts): void {
  // Keep latest values in refs so the unmount flush can read current data
  const bodyRef = useRef(body);
  const scopeRef = useRef(scope);
  const userIdRef = useRef(userId);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!body.trim()) return;

    const timer = setTimeout(() => {
      saveDraft(scope, userId, body);
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, debounceMs]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      const b = bodyRef.current;
      if (b.trim()) {
        saveDraft(scopeRef.current, userIdRef.current, b);
      }
    };
  }, []);
}
