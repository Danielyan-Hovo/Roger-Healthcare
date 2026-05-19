// Mirrors backend Pydantic schemas exactly (snake_case preserved end-to-end).

export interface PatientSummary {
  id: string;
  name: string;
  date_of_birth: string;
  version: number;
  updated_at: string;
  latest_encounter_at: string | null;
}

export interface EncounterRead {
  id: string;
  patient_id: string;
  transcript: string;
  summary: string;
  transcript_hash: string;
  created_at: string;
  updated_at: string;
}

export interface EncounterReadWithCacheFlag extends EncounterRead {
  summary_cached: boolean;
}

export interface PatientDetail {
  id: string;
  name: string;
  date_of_birth: string;
  medical_history: string;
  version: number;
  created_at: string;
  updated_at: string;
  encounters: EncounterRead[];
}

export interface PatientCreatePayload {
  name: string;
  date_of_birth: string;
  medical_history?: string;
}

export interface PatientUpdatePayload {
  medical_history: string;
  expected_version: number;
  expected_updated_at: string;
}

export interface EncounterCreatePayload {
  patient_id: string;
  transcript: string;
}

export interface EncounterUpdatePayload {
  transcript: string;
}

export interface VersionConflictBody {
  error: "version_conflict";
  current: PatientDetail;
}
