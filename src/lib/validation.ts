import { z } from "zod";
import { parseLocalDateTime } from "./dates";

export const EVENT_TYPES = ["quince", "wedding", "birthday", "party", "corporate", "other"] as const;

export const EVENT_TYPE_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
  quince: "Cumpleaños de 15",
  wedding: "Casamiento",
  birthday: "Cumpleaños",
  party: "Fiesta",
  corporate: "Evento empresarial",
  other: "Otro",
};

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre.").max(80),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido.");

export const eventInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del evento.").max(120),
  type: z.enum(EVENT_TYPES),
  date: z.preprocess(
    (v) => (typeof v === "string" && v ? parseLocalDateTime(v) : v),
    z.date({ errorMap: () => ({ message: "Ingresá una fecha y hora válidas." }) }).refine((d) => !Number.isNaN(d.getTime()), "Ingresá una fecha y hora válidas."),
  ),
  venue: z.string().trim().max(160).optional().transform((v) => (v ? v : undefined)),
  brandColor: hexColor.default("#FF5B2E"),
  storageDays: z.coerce.number().int().min(1).max(365).default(30),
});

export type EventInput = z.infer<typeof eventInputSchema>;

export const uploadSettingsSchema = z.object({
  allowVideos: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  maxPhotoMb: z.coerce.number().int().min(1, "Mínimo 1 MB.").max(50, "Máximo 50 MB."),
  maxVideoMb: z.coerce.number().int().min(5, "Mínimo 5 MB.").max(1024, "Máximo 1024 MB."),
  maxVideoSeconds: z.coerce.number().int().min(5, "Mínimo 5 segundos.").max(300, "Máximo 300 segundos."),
  maxFilesPerGuest: z.coerce.number().int().min(1, "Mínimo 1.").max(500, "Máximo 500."),
});

export type UploadSettingsInput = z.infer<typeof uploadSettingsSchema>;
