# AskMyPDF

Chat with your PDF. Upload a document, ask questions about its contents, and get AI-generated answers grounded in what the document actually says — responding in your language.

## Features

- **PDF Q&A**: Upload a PDF (max 10MB), ask questions, get answers extracted only from that document.
- **Session-based**: Ask follow-up questions without re-uploading. Sessions persist for 30 minutes.
- **Multilingual**: Answers are returned in the same natural spoken language as your question (the AI does not output code or binary).
- **Rate limiting**: Per-IP: 1 upload and 5 queries per day; global: 50 uploads per day across all users.
- **Groq AI**: Default model `openai/gpt-oss-20b`, configurable via `GROQ_MODEL_ID`.
- **Dark chat UI**: Auto-scroll, loading indicators, limit banners, and controls disabled once limits are reached.
- **Local persistence**: Limit states saved to `localStorage` so they survive page refreshes.

## Architecture

```
React (Vite) frontend  ──▶  Express backend  ──▶  Groq API (gpt-oss-20b)
        │                          │
        └──── fetch /api/upload, /api/query ──┘
                                  │
                             Upstash Redis
                    (sessions 30min TTL + rate limits)
```

- **Frontend** (`src/`): React + Vite + TailwindCSS. Handles PDF selection, file upload, chat display, and editing states. Reads the backend URL from `VITE_API_URL`.
- **Backend** (`backend/index.js`): Express server. Extracts text from the PDF with `pdf-parse`, stores it in Upstash Redis keyed by a session ID, and streams questions to the Groq API. No files are written to disk.

### API endpoints

| Method | Path          | Description                                        |
|--------|---------------|----------------------------------------------------|
| GET    | `/health`     | Health check.                                      |
| POST   | `/api/upload` | Multipart `pdf` field. Returns `sessionId`.        |
| POST   | `/api/query`  | JSON `{ sessionId, question }`. Returns `answer`.  |

**Upload** extracts up to the first 30,000 characters of PDF text and stores it under a session (24-hour TTL — sessions are valid for 30 minutes). **Query** retrieves that text and asks Groq to answer only from it. Questions are limited to 250 characters.

## Tech stack

- **Frontend**: React 19, Vite 7, TailwindCSS 4, react-icons, framer-motion
- **Backend**: Express, multer, pdf-parse, axios
- **AI**: Groq API (`openai/gpt-oss-20b`, configurable)
- **Storage / limits**: Upstash Redis + `@upstash/ratelimit`
- **Deploy**: Render (backend), Vercel (frontend)

## Getting started

### Prerequisites

- Node.js v20+
- pnpm
- Accounts: [Groq](https://console.groq.com) (API key), [Upstash](https://console.upstash.com) (Redis)

### Backend

```bash
cd backend
pnpm install
cp .env.example .env   # then fill in your keys
pnpm start             # runs on http://localhost:5000
```

`.env` variables:

```
PORT=5000
GROQ_API_KEY=gsk_your_groq_key_here
GROQ_MODEL_ID=openai/gpt-oss-20b
UPSTASH_REDIS_REST_URL=your_upstash_url_here
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
```

`GROQ_MODEL_ID` is optional; it defaults to `openai/gpt-oss-20b`. Any other Groq model ID can be used here.

### Frontend

```bash
pnpm install       # from the project root
cp .env.example .env   # set VITE_API_URL
```

`.env` variable:

```
VITE_API_URL=http://localhost:5000
```

Then run `pnpm dev` and open http://localhost:5173.

## Deployment

- **Backend (Render)**: connect the repo, set root to `backend`, runtime Node, build `pnpm install`, start `pnpm start`. Add the env vars above.
- **Frontend (Vercel)**: connect the repo, set `VITE_API_URL` to your Render URL, build with pnpm.
- **UptimeRobot (optional)**: ping `https://<render-url>/health` every 5 minutes to keep the free-tier instance awake.
- **Upstash**: create a free Redis DB and add its URL/token to Render.

## Limitations

- Rate limits are IP-based; there are no user accounts.
- Free-tier Render sleeps after ~15 minutes of inactivity (use UptimeRobot).
- Upstash free plan allows ~10k commands/day.
- PDF text is capped at ~30k characters; files max 10MB.
- Answers are based only on the PDF content — no external knowledge.
