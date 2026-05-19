import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
  VersionConflictError,
} from "../api/client";
import type {
  PatientCreatePayload,
  PatientDetail,
  PatientSummary,
  PatientUpdatePayload,
} from "../api/types";

export const patientsKey = ["patients"] as const;
export const patientKey = (id: string) => ["patient", id] as const;

export function usePatients() {
  return useQuery<PatientSummary[]>({
    queryKey: patientsKey,
    queryFn: listPatients,
  });
}

export function usePatient(id: string | null) {
  return useQuery<PatientDetail>({
    queryKey: id ? patientKey(id) : ["patient", "none"],
    queryFn: () => getPatient(id as string),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation<PatientDetail, Error, PatientCreatePayload>({
    mutationFn: createPatient,
    onSuccess: (patient) => {
      qc.invalidateQueries({ queryKey: patientsKey });
      qc.setQueryData(patientKey(patient.id), patient);
    },
  });
}

interface UpdatePatientArgs {
  id: string;
  payload: PatientUpdatePayload;
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation<PatientDetail, Error, UpdatePatientArgs>({
    mutationFn: ({ id, payload }) => updatePatient(id, payload),
    onSuccess: (patient) => {
      qc.setQueryData(patientKey(patient.id), patient);
      qc.invalidateQueries({ queryKey: patientsKey });
    },
    onError: (err, vars) => {
      // On 409, the API returns the freshest server-side state. Drop it
      // into the cache so the caller can prompt the user to refresh.
      if (err instanceof VersionConflictError) {
        qc.setQueryData(patientKey(vars.id), err.current);
      }
    },
  });
}
