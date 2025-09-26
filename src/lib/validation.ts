import { z } from 'zod';

// Authentication validation schemas
export const authSignUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" })
    .regex(/^[a-zA-Z\s-']+$/, { message: "First name can only contain letters, spaces, hyphens, and apostrophes" }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" })
    .regex(/^[a-zA-Z\s-']+$/, { message: "Last name can only contain letters, spaces, hyphens, and apostrophes" }),
});

export const authSignInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

// Club validation schemas
export const clubCreationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Club name is required" })
    .max(100, { message: "Club name must be less than 100 characters" })
    .regex(/^[a-zA-Z0-9\s-'&.]+$/, { message: "Club name can only contain letters, numbers, spaces, hyphens, apostrophes, ampersands, and periods" }),
});

// Player validation schemas
export const playerCreationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" })
    .regex(/^[a-zA-Z\s-']+$/, { message: "First name can only contain letters, spaces, hyphens, and apostrophes" }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" })
    .regex(/^[a-zA-Z\s-']+$/, { message: "Last name can only contain letters, spaces, hyphens, and apostrophes" }),
  jerseyNumber: z
    .number()
    .int({ message: "Jersey number must be a whole number" })
    .min(1, { message: "Jersey number must be at least 1" })
    .max(999, { message: "Jersey number must be less than 1000" })
    .optional(),
});

// Team validation schemas
export const teamCreationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Team name is required" })
    .max(100, { message: "Team name must be less than 100 characters" })
    .regex(/^[a-zA-Z0-9\s-'&.]+$/, { message: "Team name can only contain letters, numbers, spaces, hyphens, apostrophes, ampersands, and periods" }),
  teamType: z.enum(['11-a-side', '9-a-side', '7-a-side', '5-a-side'], {
    errorMap: () => ({ message: "Please select a valid team type" }),
  }),
});

// Fixture validation schemas
export const fixtureCreationSchema = z.object({
  opponentName: z
    .string()
    .trim()
    .min(1, { message: "Opponent name is required" })
    .max(100, { message: "Opponent name must be less than 100 characters" })
    .regex(/^[a-zA-Z0-9\s-'&.]+$/, { message: "Opponent name can only contain letters, numbers, spaces, hyphens, apostrophes, ampersands, and periods" }),
  location: z
    .string()
    .trim()
    .max(200, { message: "Location must be less than 200 characters" })
    .optional(),
  competitionName: z
    .string()
    .trim()
    .max(100, { message: "Competition name must be less than 100 characters" })
    .optional(),
  scheduledDate: z
    .date({ message: "Please select a valid date" })
    .min(new Date(Date.now() - 24 * 60 * 60 * 1000), { message: "Date cannot be more than 1 day in the past" }),
  fixtureType: z.enum(['home', 'away', 'neutral'], {
    errorMap: () => ({ message: "Please select a valid fixture type" }),
  }),
  competitionType: z.enum(['friendly', 'league', 'cup', 'tournament'], {
    errorMap: () => ({ message: "Please select a valid competition type" }),
  }),
});

// Types for validation results
export type AuthSignUpData = z.infer<typeof authSignUpSchema>;
export type AuthSignInData = z.infer<typeof authSignInSchema>;
export type ClubCreationData = z.infer<typeof clubCreationSchema>;
export type PlayerCreationData = z.infer<typeof playerCreationSchema>;
export type TeamCreationData = z.infer<typeof teamCreationSchema>;
export type FixtureCreationData = z.infer<typeof fixtureCreationSchema>;