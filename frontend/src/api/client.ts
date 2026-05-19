import axios, { AxiosError } from "axios";

import type {
  EncounterCreatePayload,
  EncounterReadWithCacheFlag,
  EncounterUpdatePayload,
  PatientCreatePayload,
  PatientDetail,
  PatientSummary,
  PatientUpdatePayload,
  VersionConflictBody,
} from "./types";

const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export const http = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

export class VersionConflictError extends Error {
  current: PatientDetail;
  constructor(current: PatientDetail) {
    super("version_conflict");
    this.name = "VersionConflictError";
    this.current = current;
  }
}

// ----- Patients --------------------------------------------------------- //

export async function listPatients(): Promise<PatientSummary[]> {
  const { data } = await http.get<PatientSummary[]>("/api/patients");
  return data;
}

export async function getPatient(id: string): Promise<PatientDetail> {
  const { data } = await http.get<PatientDetail>(`/api/patients/${id}`);
  return data;
}

export async function createPatient(
  payload: PatientCreatePayload
): Promise<PatientDetail> {
  const { data } = await http.post<PatientDetail>("/api/patients", payload);
  return data;
}

export async function updatePatient(
  id: string,
  payload: PatientUpdatePayload
): Promise<PatientDetail> {
  try {
    const { data } = await http.patch<PatientDetail>(
      `/api/patients/${id}`,
      payload
    );
    return data;
  } catch (err) {
    const ax = err as AxiosError<VersionConflictBody>;
    if (ax.response?.status === 409 && ax.response.data?.error === "version_conflict") {
      throw new VersionConflictError(ax.response.data.current);
    }
    throw err;
  }
}

// ----- Encounters ------------------------------------------------------- //

export async function createEncounter(
  payload: EncounterCreatePayload
): Promise<EncounterReadWithCacheFlag> {
  const { data } = await http.post<EncounterReadWithCacheFlag>(
    "/api/encounters",
    payload
  );
  return data;
}

export async function updateEncounter(
  id: string,
  payload: EncounterUpdatePayload
): Promise<EncounterReadWithCacheFlag> {
  const { data } = await http.put<EncounterReadWithCacheFlag>(
    `/api/encounters/${id}`,
    payload
  );
  return data;
}
