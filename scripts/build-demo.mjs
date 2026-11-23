import { build } from "vite";

// The public Vercel deployment is intentionally a browser-only demo.
process.env.VITE_DEMO_MODE = "true";
await build();
