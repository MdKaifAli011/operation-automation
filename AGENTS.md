<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a standalone Next.js 16 (App Router, Turbopack) frontend application using npm as its package manager. There are no backend services, databases, or external APIs — all data is mock/in-memory.

### Services

| Service | Command | Port |
|---------|---------|------|
| Next.js dev server | `npm run dev` | 3000 |

### Lint / Build / Dev

Standard commands from `package.json`:
- **Lint**: `npm run lint` (ESLint)
- **Build**: `npm run build`
- **Dev**: `npm run dev` (starts on port 3000)

No automated test suite exists in this repo (no test framework configured).

### Notes

- No `.env` files or environment variables are required.
- No authentication — the app is immediately accessible.
- The app uses Tailwind CSS v4 via `@tailwindcss/postcss`.
