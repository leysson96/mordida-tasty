export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface TimeRange {
  open: string;
  close: string;
}

export interface OpeningHours {
  timezone: string;
  weekly: Record<DayKey, TimeRange[]>;
}

export const weekdays: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miercoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
];

export function normalizeOpeningHours(value?: OpeningHours): OpeningHours {
  const weekly = weekdays.reduce(
    (acc, day) => ({
      ...acc,
      [day.key]: value?.weekly?.[day.key] ?? [],
    }),
    {} as Record<DayKey, TimeRange[]>,
  );

  return {
    timezone: value?.timezone ?? "Europe/Madrid",
    weekly,
  };
}
