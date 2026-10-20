/**
 * Loads .env.local then .env for scripts that run outside Next.js
 * (drizzle-kit, seed scripts). Import this before anything that reads env.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
