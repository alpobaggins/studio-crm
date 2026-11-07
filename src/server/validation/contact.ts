import { z } from "zod";
import { optionalEmail, optionalId, optionalPhone, optionalText, requiredText } from "./common";

export const contactSchema = z.object({
  fullName: requiredText("Укажите имя контакта"),
  // Необязательно: контакт может существовать без компании (Plan.md 1.8).
  accountId: optionalId,
  position: optionalText(),
  email: optionalEmail,
  phone: optionalPhone,
  comment: optionalText(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;
