import { z } from 'zod';

/**
 * Email composition validation schema
 * Validates recipient email, subject, and body with proper length limits
 */
export const composeEmailSchema = z.object({
  to: z
    .string()
    .min(1, "Recipient is required")
    .max(254, "Email address too long")
    .email("Invalid email format")
    .refine(
      (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      "Invalid email format"
    ),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject too long (max 200 characters)"),
  body: z
    .string()
    .max(50000, "Message too long (max 50,000 characters)")
    .optional()
    .default("")
});

/**
 * Reply validation schema
 * Similar to compose but body is required
 */
export const replyEmailSchema = z.object({
  to: z
    .string()
    .min(1, "Recipient is required")
    .email("Invalid email format"),
  subject: z
    .string()
    .max(200, "Subject too long (max 200 characters)")
    .optional(),
  body: z
    .string()
    .min(1, "Message body is required")
    .max(50000, "Message too long (max 50,000 characters)")
});

/**
 * Search query validation
 */
export const searchQuerySchema = z.object({
  query: z
    .string()
    .max(500, "Search query too long")
    .optional()
});

export type ComposeEmailInput = z.infer<typeof composeEmailSchema>;
export type ReplyEmailInput = z.infer<typeof replyEmailSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
