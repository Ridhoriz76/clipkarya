"use client";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import type { Timeline } from "@clipkarya/core";
import { api, ClientApiError } from "@/lib/client-api";
import type { SaveState } from "./types";

type State = {
  doc: Timeline;
  past: Timeline[];
  future: Timeline[];
  lastKey: string | null;
  lastAt: number;
  revision: number; // increments on every doc change (drives autosave)
};

type Action =
  | { type: "apply"; fn: (d: Timeline) => Timeline; record?: boolean; coalesceKey?: string }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; doc: Timeline };

const HISTORY_LIMIT = 100;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "apply": {
      const doc = a.fn(s.doc);
      if (doc === s.doc) return s;
      const now = Date.now();
      const coalesce = a.coalesceKey && a.coalesceKey === s.lastKey && now - s.lastAt < 800;
      const record = a.record !== false && !coalesce;
      return {
        doc,
        past: record ? [...s.past, s.doc].slice(-HISTORY_LIMIT) : s.past,
        future: record || coalesce ? [] : s.future,
        lastKey: a.coalesceKey ?? null,
        lastAt: now,
        revision: s.revision + 1,
      };
    }
    case "checkpoint":
      return { ...s, past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [], lastKey: null };
    case "undo": {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { ...s, doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], lastKey: null, revision: s.revision + 1 };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return { ...s, doc: next, past: [...s.past, s.doc], future: s.future.slice(1), lastKey: null, revision: s.revision + 1 };
    }
    case "reset":
      return { doc: a.doc, past: [], future: [], lastKey: null, lastAt: 0, revision: s.revision + 1 };
  }
}

/** Editor document store with undo/redo history and debounced autosave to the API. */
export function useEditorStore(projectId: string, initial: Timeline, initialVersion: number, onSaveState: (s: SaveState) => void) {
  const [state, dispatch] = useReducer(reducer, { doc: initial, past: [], future: [], lastKey: null, lastAt: 0, revision: 0 });
  const version = useRef(initialVersion);
  const savedRevision = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const docRef = useRef(state.doc);
  const revRef = useRef(state.revision);
  useLayoutEffect(() => {
    docRef.current = state.doc;
    revRef.current = state.revision;
  }, [state.doc, state.revision]);
  const conflict = useRef(false);

  const save = useCallback(async () => {
    if (conflict.current) return;
    if (saving.current) await saving.current;
    if (savedRevision.current === revRef.current) return;
    const rev = revRef.current;
    const doc = docRef.current;
    onSaveState("saving");
    saving.current = (async () => {
      try {
        const { version: v } = await api<{ version: number }>(`/api/projects/${projectId}/timeline`, {
          method: "PUT",
          json: { expectedVersion: version.current, timeline: doc },
        });
        version.current = v;
        savedRevision.current = rev;
        onSaveState(revRef.current === rev ? "saved" : "dirty");
      } catch (e) {
        if (e instanceof ClientApiError && e.code === "version_conflict") {
          conflict.current = true;
          onSaveState("conflict");
        } else onSaveState("error");
        throw e;
      } finally {
        saving.current = null;
      }
    })();
    return saving.current;
  }, [projectId, onSaveState]);

  useEffect(() => {
    if (state.revision === 0 || state.revision === savedRevision.current) return;
    onSaveState("dirty");
    const t = setTimeout(() => void save().catch(() => undefined), 1200);
    return () => clearTimeout(t);
  }, [state.revision, save, onSaveState]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (savedRevision.current !== revRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  return {
    doc: state.doc,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    apply: (fn: (d: Timeline) => Timeline, opts?: { record?: boolean; coalesceKey?: string }) => dispatch({ type: "apply", fn, ...opts }),
    checkpoint: () => dispatch({ type: "checkpoint" }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    /** Flush pending changes now (used before export). */
    flush: save,
  };
}

export type EditorStore = ReturnType<typeof useEditorStore>;
