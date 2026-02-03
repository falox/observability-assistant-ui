# Observability Assistant UI

Chat interface for observability AI assistant using [PatternFly Chatbot](https://www.patternfly.org/patternfly-ai/chatbot/overview) with [ag-ui protocol](https://docs.ag-ui.com) support.

## Quick Start

```bash
make install
make dev        # http://localhost:3000
```

## Tech Stack

- [React](https://react.dev) 18 + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [PatternFly](https://www.patternfly.org) 6 + [@patternfly/chatbot](https://www.patternfly.org/patternfly-ai/chatbot/overview)

## Features

- Markdown rendering (GFM tables, code blocks, lists)
- Tool calls with arguments and results (collapsed by default)
- Step/thinking progress indicators
- Time series charts for Prometheus metrics
- SSE streaming from ag-ui servers
- Light/dark/system theme support

## Demo Mode

Toggle between Demo and Production mode via the settings dropdown in the header. Demo mode is enabled by default and simulates all event types without requiring a backend.

Type a space-separated sequence of keywords to test different UI elements:

| Keyword | Effect |
|---------|--------|
| `step` | Progress stepper (3 steps) |
| `tool` | Tool call with parameters and result |
| `text` | Streaming text paragraph |
| `code` | Text with code block |
| `error` | Inline error alert |

Example: `step tool text code`

## Build

```bash
make build      # Production build in dist/
make lint       # ESLint check
make clean      # Remove dist/ and node_modules/
```

## Backend Proxy

Set backend URL via environment variable or edit `vite.config.ts`:

```bash
# Using environment variable (recommended)
AGUI_BACKEND_URL=http://localhost:5050 make dev
```

Or edit proxy target in `vite.config.ts` (defaults to `http://localhost:9010`):

```ts
proxy: {
  '/api': {
    target: process.env.AGUI_BACKEND_URL || 'http://localhost:9010',
    changeOrigin: true,
  },
}
```
