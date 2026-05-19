import { useEffect, useState } from "react";
import clsx from "clsx";

import { EncounterTimeline } from "./components/EncounterTimeline";
import { LiveTranscriptEditor } from "./components/LiveTranscriptEditor";
import { MedicalHistoryEditor } from "./components/MedicalHistoryEditor";
import { Sidebar } from "./components/Sidebar";
import { Spinner } from "./components/Spinner";
import { ToastViewport } from "./components/Toast";
import { usePatient, usePatients } from "./hooks/usePatients";

type Tab = "history" | "encounter" | "timeline";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "history", label: "Medical History", hint: "Versioned auto-saving editor" },
  { id: "encounter", label: "New Encounter", hint: "Transcribe → summarize" },
  { id: "timeline", label: "Encounter Timeline", hint: "Past visits with AI summaries" },
];

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("history");

  const { data: patients } = usePatients();
  const { data: patient, isLoading, isError } = usePatient(selectedId);

  // Auto-select the first patient on initial load.
  useEffect(() => {
    if (!selectedId && patients && patients.length > 0) {
      setSelectedId(patients[0].id);
    }
  }, [patients, selectedId]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar selectedPatientId={selectedId} onSelect={setSelectedId} />

      <main className="flex flex-1 flex-col overflow-hidden">
        <Header patientName={patient?.name ?? null} />
        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-2">
          {!selectedId ? (
            <EmptyState message="Select a patient from the sidebar to begin." />
          ) : isLoading || !patient ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">
              <Spinner className="mr-2" /> Loading patient…
            </div>
          ) : isError ? (
            <EmptyState message="Could not load patient." />
          ) : (
            <>
              <TabBar active={tab} onChange={setTab} />
              <div className="flex-1 overflow-y-auto pt-4">
                {tab === "history" ? (
                  <MedicalHistoryEditor patient={patient} />
                ) : tab === "encounter" ? (
                  <LiveTranscriptEditor patient={patient} />
                ) : (
                  <EncounterTimeline patient={patient} />
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <ToastViewport />
    </div>
  );
}

function Header({ patientName }: { patientName: string | null }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Patient Encounter Portal
        </div>
        <div className="text-lg font-semibold text-slate-900">
          {patientName ?? "No patient selected"}
        </div>
      </div>
      <a
        href="http://localhost:8000/docs"
        target="_blank"
        rel="noreferrer"
        className="btn-secondary text-xs"
      >
        API docs ↗
      </a>
    </header>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="flex items-end gap-1 border-b border-slate-200 pt-2">
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={clsx(
              "group relative -mb-px rounded-t-md px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-x border-t border-slate-200 bg-white text-brand-700"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <div>{t.label}</div>
            <div className="text-[10px] font-normal text-slate-400">{t.hint}</div>
            {isActive ? (
              <span className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-white" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
      {message}
    </div>
  );
}
