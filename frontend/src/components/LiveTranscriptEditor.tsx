import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { useCreateEncounter } from "../hooks/useEncounters";
import { useToast } from "../hooks/useToast";
import type { PatientDetail } from "../api/types";
import { Spinner } from "./Spinner";

interface LiveTranscriptEditorProps {
  patient: PatientDetail;
}

export function LiveTranscriptEditor({ patient }: LiveTranscriptEditorProps) {
  const [transcript, setTranscript] = useState("");
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [previewCached, setPreviewCached] = useState<boolean | null>(null);

  const { mutateAsync, isPending } = useCreateEncounter(patient.id);
  const { push } = useToast();

  const generate = async () => {
    try {
      const enc = await mutateAsync({
        patient_id: patient.id,
        transcript,
      });
      setPreviewSummary(enc.summary);
      setPreviewCached(enc.summary_cached);
      push({
        variant: "success",
        message: enc.summary_cached
          ? "AI summary cached (zero tokens spent)"
          : "Encounter saved and summarized",
      });
      setTranscript("");
    } catch (err) {
      push({
        variant: "error",
        message: `Failed to create encounter: ${(err as Error).message}`,
      });
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">New Encounter</h2>
          <p className="text-xs text-slate-500">
            Paste or type the visit transcript, then click Generate Summary.
          </p>
        </div>
        {previewCached === true ? (
          <span className="badge bg-emerald-100 text-emerald-800">AI Summary cached</span>
        ) : previewCached === false ? (
          <span className="badge bg-brand-100 text-brand-800">AI Summary regenerated</span>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Live transcript
          </label>
          <textarea
            className="input min-h-[18rem] resize-y font-mono text-xs leading-relaxed"
            placeholder="- Patient reports..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {transcript.trim().length} chars · empty transcripts skip the LLM
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={generate}
              disabled={isPending}
            >
              {isPending ? <Spinner size="sm" className="mr-2" /> : null}
              Generate Summary
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Preview
          </label>
          <div className="markdown min-h-[18rem] rounded-md bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            {previewSummary ? (
              <ReactMarkdown>{previewSummary}</ReactMarkdown>
            ) : (
              <p className="text-xs text-slate-500">
                Summary preview will appear here after you click Generate.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
