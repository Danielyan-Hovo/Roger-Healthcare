import { useState } from "react";
import clsx from "clsx";

import { useCreatePatient, usePatients } from "../hooks/usePatients";
import { useToast } from "../hooks/useToast";
import { Spinner } from "./Spinner";

interface SidebarProps {
  selectedPatientId: string | null;
  onSelect: (id: string) => void;
}

function formatDob(iso: string): string {
  // iso looks like 1944-01-02
  const [y, m, d] = iso.split("-");
  if (!y) return iso;
  return `${m}/${d}/${y}`;
}

export function Sidebar({ selectedPatientId, onSelect }: SidebarProps) {
  const { data: patients, isLoading, isError } = usePatients();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          R
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight text-slate-900">
            Roger Health
          </div>
          <div className="text-xs text-slate-500">Encounter Portal</div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Patients
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          {showCreate ? "Cancel" : "+ New"}
        </button>
      </div>

      {showCreate ? (
        <CreatePatientForm
          onCancel={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            onSelect(id);
          }}
        />
      ) : null}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
            <Spinner /> Loading patients…
          </div>
        ) : isError ? (
          <div className="px-3 py-3 text-sm text-rose-600">
            Failed to load patients.
          </div>
        ) : patients && patients.length > 0 ? (
          <ul className="space-y-1">
            {patients.map((p) => {
              const active = p.id === selectedPatientId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className={clsx(
                      "w-full rounded-lg px-3 py-2 text-left transition",
                      active
                        ? "bg-brand-50 ring-1 ring-brand-200"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={clsx(
                        "text-sm font-medium",
                        active ? "text-brand-800" : "text-slate-900"
                      )}
                    >
                      {p.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>DOB {formatDob(p.date_of_birth)}</span>
                      <span className="text-slate-300">•</span>
                      <span>v{p.version}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-3 py-6 text-sm text-slate-500">
            No patients yet. Click <span className="font-medium">+ New</span> to add one.
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
        Roger Health · Internal demo build
      </div>
    </aside>
  );
}

interface CreatePatientFormProps {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

function CreatePatientForm({ onCreated, onCancel }: CreatePatientFormProps) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const { mutateAsync, isPending } = useCreatePatient();
  const { push } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dob) return;
    try {
      const patient = await mutateAsync({
        name: name.trim(),
        date_of_birth: dob,
        medical_history: "",
      });
      push({ variant: "success", message: `Created patient ${patient.name}` });
      setName("");
      setDob("");
      onCreated(patient.id);
    } catch (err) {
      push({
        variant: "error",
        message: `Could not create patient: ${(err as Error).message}`,
      });
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-3 mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Full name
      </label>
      <input
        className="input mb-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Jane Doe"
        required
      />
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Date of birth
      </label>
      <input
        type="date"
        className="input mb-3"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        required
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? <Spinner size="sm" className="mr-2" /> : null}
          Create
        </button>
      </div>
    </form>
  );
}
