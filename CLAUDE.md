# CLAUDE.md

## Project Overview

PatternFly Chatbot PoC for ag-ui protocol integration. Demonstrates tools, steps, and markdown rendering.

## Commands

```bash
pnpm dev        # Start dev server on :3000
pnpm build      # Production build
pnpm lint       # Run ESLint
```

## Debugging

Use VS Code: Run & Debug (F5) → "Debug in Chrome". Start `pnpm dev` first.

## Key Files

- `src/App.tsx` - Main app, toggle `DEMO_MODE` for mock/real backend
- `src/components/ChatWindow.tsx` - Chat layout (header, content, footer)
- `src/components/MessageList.tsx` - Message rendering with tools/steps
- `src/hooks/useAgUiStream.ts` - ag-ui SSE streaming hook
- `src/types/agui.ts` - ag-ui event type definitions
- `vite.config.ts` - Dev server proxy configuration

## Architecture

```
User Input → MessageBar → useAgUiStream → POST /api/chat
                                              ↓
UI Update ← Message components ← SSE events (ag-ui protocol)
```

## ag-ui Events Handled

| Event | UI Effect |
|-------|-----------|
| `TEXT_MESSAGE_*` | Stream message content |
| `TOOL_CALL_*` | Show tool name, args, result |
| `STEP_*` | Progress labels |
| `RUN_ERROR` | Error display |
