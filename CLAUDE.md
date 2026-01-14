# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PatternFly Chatbot PoC for ag-ui protocol integration. Demonstrates tools, steps, and markdown rendering.

## Commands

```bash
make dev        # Start dev server on :3000
make build      # Production build (runs tsc -b first)
make lint       # Run ESLint
make preview    # Preview production build
make clean      # Remove dist/ and node_modules/
```

## Debugging

- VS Code: Run & Debug (F5) → "Debug in Chrome". Start `make dev` first.
- Browser console shows `[AG-UI] OUT:` (requests) and `[AG-UI] IN:` (events) when not in demo mode.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app, demo/prod mode toggle (persisted in localStorage) |
| `src/components/ChatWindow.tsx` | Chat layout (header, content, footer) |
| `src/components/MessageList.tsx` | Message rendering with tools/steps/errors |
| `src/hooks/useAgUiStream.ts` | ag-ui SSE streaming hook and event processing |
| `src/types/agui.ts` | ag-ui event type definitions |
| `vite.config.ts` | Dev server proxy configuration |

## Architecture

```
User Input → MessageBar → useAgUiStream → POST /api/agui/chat
                                               ↓
UI Update ← Message components ← SSE events (ag-ui protocol)
```

See [docs/EVENT_HANDLING.md](./docs/EVENT_HANDLING.md) for detailed event processing documentation.

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
| `RUN_STARTED/FINISHED` | Run lifecycle, loading state |
| `TEXT_MESSAGE_*` | Stream message content |
| `TOOL_CALL_*` | Show tool name, args, result |
| `STEP_*` | Progress stepper labels |
| `RUN_ERROR` | Inline error alert |

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

## Architecture Decisions

### State Management: Refs + React State

**Decision:** Use `useRef` for streaming accumulation, commit to React state only on significant changes.

**Rationale:** SSE events arrive rapidly (character-by-character for text). Calling `setMessages()` on every delta would cause excessive re-renders. Refs accumulate state without triggering renders, then batch updates via `updateCurrentMessage()`.

**Key refs:**
- `currentMessageRef` - Active assistant message being built
- `toolCallsRef` - Map of tool calls by ID
- `stepsRef` - Map of steps by ID
- `contentBlocksRef` - Ordered list of content blocks

### Content Blocks for Ordered Rendering

**Decision:** Messages contain a `contentBlocks[]` array that tracks the order of text, steps, and tools.

**Rationale:** ag-ui events can arrive interleaved (text → step → more text → tool). ContentBlocks preserve this ordering so the UI renders elements in the sequence they were received, not grouped by type.

**Block types:** `text`, `steps`, `tools`

### Tool Calls Collapsed by Default

**Decision:** Tool call details (args/result) are collapsed by default.

**Rationale:** Tool results can be large (multi-KB JSON). Showing expanded by default would dominate the chat UI. Users can expand when they want details.

### Inline Error Display

**Decision:** `RUN_ERROR` events create messages with an error object, rendered as PatternFly Alert inline.

**Rationale:** Errors are contextual to the conversation flow. Inline alerts keep errors visible in context rather than as disconnected toasts.

### Demo Mode Simulation

**Decision:** Demo/Prod mode toggle persisted in localStorage, switchable via UI.

**Rationale:** Enables UI development and testing without running the backend. Simulates all event types including streaming text, tool calls, and steps.

**Implementation:**
- Stored in localStorage under `app-mode` key (`'demo'` | `'prod'`)
- Defaults to demo mode if not set
- UI toggle in ChatWindow header switches between modes
