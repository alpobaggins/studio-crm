import { z } from "zod";
import { optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

export const accountSchema = z.object({
  name: requiredText("Укажите название компании"),
  industry: optionalText(),
  city: optionalText(),
  website: optionalText(),
  email: optionalEmail,
  phone: optionalPhone,
  comment: optionalText(2000),
});

export type AccountInput = z.infer<typeof accountSchema>;
