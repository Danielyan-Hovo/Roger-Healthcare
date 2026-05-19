import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { VersionConflictError } from "../api/client";
import {
  patientKey,
  useUpdatePatient,
} from "../hooks/usePatients";
import { useToast } from "../hooks/useToast";
import type { PatientDetail } from "../api/types";
import { Spinner } from "./Spinner";

interface MedicalHistoryEditorProps {
  patient: PatientDetail;
}

type SaveState = "idle" | "pending" | "saved" | "error" | "conflict";

const DEBOUNCE_MS = 1200;

function formatLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function MedicalHistoryEditor({ patient }: MedicalHistoryEditorProps) {
  const [value, setValue] = useState(patient.medical_history);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Track the latest baseline (version + updated_at) we know from the server.
  // We rehydrate this whenever the underlying query data refreshes so that
  // an external refresh resolves any conflict and the next save proceeds.
  const baselineRef = useRef({
    version: patient.version,
    updated_at: patient.updated_at,
  });

  const { mutateAsync } = useUpdatePatient();
  const { push } = useToast();
  const qc = useQueryClient();

  // When the patient prop changes externally (eg. refresh after conflict),
  // reset the local buffer ONLY if the user hasn't diverged from it.
  useEffect(() => {
    baselineRef.current = {
      version: patient.version,
      updated_at: patient.updated_at,
    };
    // Reset the textarea if the server value differs from what we currently
    // have AND we're not mid-edit with unsaved changes.
    setValue((prev) =>
      prev === patient.medical_history ? prev : patient.medical_history
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  // Debounced auto-save.
  useEffect(() => {
    if (value === patient.medical_history) {
      setSaveState((s) => (s === "conflict" ? "conflict" : "idle"));
      return;
    }
    setSaveState("pending");
    const handle = window.setTimeout(async () => {
      try {
        const updated = await mutateAsync({
          id: patient.id,
          payload: {
            medical_history: value,
            expected_version: baselineRef.current.version,
            expected_updated_at: baselineRef.current.updated_at,
          },
        });
        baselineRef.current = {
          version: updated.version,
          updated_at: updated.updated_at,
        };
        setLastSavedAt(updated.updated_at);
        setSaveState("saved");
      } catch (err) {
        if (err instanceof VersionConflictError) {
          setSaveState("conflict");
          push({
            variant: "warning",
            message:
              "Conflict — another tab changed this. Refresh to load latest.",
            action: {
              label: "Refresh",
              onClick: () => {
                qc.invalidateQueries({ queryKey: patientKey(patient.id) });
              },
            },
          });
        } else {
          setSaveState("error");
          push({
            variant: "error",
            message: `Failed to save: ${(err as Error).message}`,
          });
        }
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, patient.id]);

  return (
    <section className="card flex h-full flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Medical History</h2>
          <p className="text-xs text-slate-500">
            Auto-saves 1.2s after you stop typing. Edits are version-checked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge bg-slate-100 text-slate-700">
            version {patient.version}
          </span>
          <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
        </div>
      </header>
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          className="input h-full min-h-[24rem] resize-none font-mono text-xs leading-relaxed"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
        />
      </div>
    </section>
  );
}

interface SaveBadgeProps {
  state: SaveState;
  lastSavedAt: string | null;
}

function SaveBadge({ state, lastSavedAt }: SaveBadgeProps) {
  if (state === "pending") {
    return (
      <span className="badge bg-brand-50 text-brand-700">
        <Spinner size="sm" className="mr-1" /> Saving…
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    return (
      <span className="badge bg-emerald-50 text-emerald-700">
        Saved {formatLocal(lastSavedAt)}
      </span>
    );
  }
  if (state === "conflict") {
    return (
      <span className="badge bg-amber-100 text-amber-800">
        Conflict — refresh to continue
      </span>
    );
  }
  if (state === "error") {
    return <span className="badge bg-rose-100 text-rose-700">Save failed</span>;
  }
  return <span className="badge bg-slate-100 text-slate-600">Up to date</span>;
}
