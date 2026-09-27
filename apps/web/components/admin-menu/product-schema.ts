import { z } from "zod";

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe un nombre con al menos 2 caracteres.")
    .max(120, "El nombre no debe superar 120 caracteres."),
  categoryId: z.string().min(1, "Elige una categoria."),
  price: z
    .number({ error: "Indica un precio valido." })
    .finite("Indica un precio valido.")
    .min(0.01, "Indica un precio mayor que 0.")
    .max(9999, "Revisa el precio; parece demasiado alto."),
  sortOrder: z
    .number({ error: "Indica un orden valido." })
    .finite("Indica un orden valido.")
    .int("El orden debe ser un numero entero.")
    .min(0, "El orden no puede ser negativo.")
    .max(10000, "El orden no debe superar 10000."),
  description: z
    .string()
    .trim()
    .min(4, "Escribe una descripcion corta.")
    .max(700, "La descripcion no debe superar 700 caracteres."),
  active: z.boolean().default(true),
  imageFile: z.unknown().optional(),
  currentImageUrl: z.string().optional(),
});

export type ProductFormValues = z.input<typeof productFormSchema>;
