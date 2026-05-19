import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createEncounter, updateEncounter } from "../api/client";
import type {
  EncounterCreatePayload,
  EncounterReadWithCacheFlag,
  EncounterUpdatePayload,
} from "../api/types";
import { patientKey, patientsKey } from "./usePatients";

export function useCreateEncounter(patientId: string | null) {
  const qc = useQueryClient();
  return useMutation<EncounterReadWithCacheFlag, Error, EncounterCreatePayload>({
    mutationFn: createEncounter,
    onSuccess: () => {
      if (patientId) qc.invalidateQueries({ queryKey: patientKey(patientId) });
      qc.invalidateQueries({ queryKey: patientsKey });
    },
  });
}

interface UpdateEncounterArgs {
  id: string;
  payload: EncounterUpdatePayload;
}

export function useUpdateEncounter(patientId: string | null) {
  const qc = useQueryClient();
  return useMutation<EncounterReadWithCacheFlag, Error, UpdateEncounterArgs>({
    mutationFn: ({ id, payload }) => updateEncounter(id, payload),
    onSuccess: () => {
      if (patientId) qc.invalidateQueries({ queryKey: patientKey(patientId) });
      qc.invalidateQueries({ queryKey: patientsKey });
    },
  });
}
