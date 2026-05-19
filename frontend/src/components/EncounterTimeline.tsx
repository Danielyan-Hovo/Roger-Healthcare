import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { useUpdateEncounter } from "../hooks/useEncounters";
import { useToast } from "../hooks/useToast";
import type { EncounterRead, PatientDetail } from "../api/types";
import { Spinner } from "./Spinner";

interface EncounterTimelineProps {
  patient: PatientDetail;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function EncounterTimeline({ patient }: EncounterTimelineProps) {
  if (patient.encounters.length === 0) {
    return (
      <section className="card p-6 text-center text-sm text-slate-500">
        No encounters yet. Use <span className="font-medium">New Encounter</span> to add one.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {patient.encounters.map((e) => (
        <EncounterCard key={e.id} encounter={e} patientId={patient.id} />
      ))}
    </section>
  );
}

interface EncounterCardProps {
  encounter: EncounterRead;
  patientId: string;
}

function EncounterCard({ encounter, patientId }: EncounterCardProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [lastCacheState, setLastCacheState] = useState<"cached" | "regenerated" | null>(null);

  const { mutateAsync, isPending } = useUpdateEncounter(patientId);
  const { push } = useToast();

  const regenerate = async () => {
    try {
      const updated = await mutateAsync({
        id: encounter.id,
        payload: { transcript: encounter.transcript },
      });
      setLastCacheState(updated.summary_cached ? "cached" : "regenerated");
      push({
        variant: "success",
        message: updated.summary_cached
          ? "AI summary cached (no LLM call)"
          : "AI summary regenerated",
      });
    } catch (err) {
      push({
        variant: "error",
        message: `Could not refresh summary: ${(err as Error).message}`,
      });
    }
  };

  const hasSummary = encounter.summary && encounter.summary.trim().length > 0;

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Encounter · {formatDate(encounter.created_at)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            hash {encounter.transcript_hash.slice(0, 12)}…
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastCacheState === "cached" ? (
            <span className="badge bg-emerald-100 text-emerald-800">AI Summary cached</span>
          ) : lastCacheState === "regenerated" ? (
            <span className="badge bg-brand-100 text-brand-800">AI Summary regenerated</span>
          ) : null}
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={regenerate}
            disabled={isPending}
          >
            {isPending ? <Spinner size="sm" className="mr-1" /> : null}
            Re-summarize
          </button>
        </div>
      </header>

      <div className="px-4 py-3">
        {hasSummary ? (
          <div className="markdown">
            <ReactMarkdown>{encounter.summary}</ReactMarkdown>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No summary yet — open <span className="font-medium">New Encounter</span>
            {" "}above and click <span className="font-medium">Generate Summary</span>.
          </div>
        )}

        <button
          type="button"
          className="mt-3 text-xs font-medium text-brand-700 hover:underline"
          onClick={() => setShowTranscript((v) => !v)}
        >
          {showTranscript ? "Hide raw transcript" : "Show raw transcript"}
        </button>
        {showTranscript ? (
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-100">
{encounter.transcript || "(empty transcript)"}
          </pre>
        ) : null}
      </div>
    </article>
  );
}
