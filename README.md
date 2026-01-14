# Observability Assistant UI

PoC chat interface using PatternFly Chatbot with ag-ui protocol support.

## Quick Start

```bash
make install
make dev        # http://localhost:3000
```

## Tech Stack

- React 18 + TypeScript + Vite
- PatternFly 6 + @patternfly/chatbot

## Features

- Markdown rendering (tables, code blocks, lists)
- Tool calls with arguments and results
- Step/thinking progress indicators
- SSE streaming from ag-ui servers

## Demo Mode

Enabled by default. Set `DEMO_MODE = false` in `src/App.tsx` to connect to a real backend.

## Build

```bash
make build      # Production build in dist/
make lint       # ESLint check
make clean      # Remove dist/ and node_modules/
```

## Backend Proxy

Configure in `vite.config.ts`:

```ts
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  },
}
```
