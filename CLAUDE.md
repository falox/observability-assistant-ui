# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PatternFly Chatbot PoC for ag-ui protocol integration. Demonstrates tools, steps, and markdown rendering.

## Commands

```bash
pnpm dev        # Start dev server on :3000
pnpm build      # Production build (runs tsc -b first)
pnpm lint       # Run ESLint
pnpm preview    # Preview production build
```

## Debugging

- VS Code: Run & Debug (F5) → "Debug in Chrome". Start `pnpm dev` first.
- Browser console shows `[AG-UI] OUT:` (requests) and `[AG-UI] IN:` (events) when not in demo mode.

## Key Files

- `src/App.tsx` - Main app, toggle `DEMO_MODE` for mock/real backend
- `src/components/ChatWindow.tsx` - Chat layout (header, content, footer)
- `src/components/MessageList.tsx` - Message rendering with tools/steps
- `src/hooks/useAgUiStream.ts` - ag-ui SSE streaming hook
- `src/types/agui.ts` - ag-ui event type definitions
- `vite.config.ts` - Dev server proxy configuration (target port)

## Architecture

```
User Input → MessageBar → useAgUiStream → POST /api/agui/chat
                                               ↓
UI Update ← Message components ← SSE events (ag-ui protocol)
```

## ag-ui Protocol

### Request Body (RunAgentInput)

All fields are required per ag-ui spec:

```typescript
{
  threadId: string,
  runId: string,
  messages: [{ id, role, content }],
  state: {},
  tools: [],
  context: [],
  forwardedProps: {}
}
```

### Events Handled

| Event | UI Effect |
|-------|-----------|
| `TEXT_MESSAGE_*` | Stream message content |
| `TOOL_CALL_*` | Show tool name, args, result |
| `STEP_*` | Progress labels |
| `RUN_ERROR` | Error display |

## Backend Configuration

Edit proxy target in `vite.config.ts`:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5050',  // Change port here
    changeOrigin: true,
  },
}
```
