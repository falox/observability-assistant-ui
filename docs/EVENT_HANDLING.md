# Event Handling

This document describes how ag-ui protocol events are received, processed, and rendered in the UI.

## Processing Pipeline

```
POST /api/agui/chat
         ↓
   SSE Stream (fetch + ReadableStream)
         ↓
   Parse "data: {json}" lines
         ↓
   handleEvent() switch dispatcher
         ↓
   Update refs (toolCallsRef, stepsRef, contentBlocksRef)
         ↓
   updateCurrentMessage() → setMessages()
         ↓
   MessageList re-renders → ContentBlockRenderer
```

## Event Types

The protocol defines 13 event types in `src/types/agui.ts`:

### Run Lifecycle

| Event | Fields | Description |
|-------|--------|-------------|
| `RUN_STARTED` | `runId`, `threadId?` | Marks run beginning, shows loading state |
| `RUN_FINISHED` | `runId`, `threadId?` | Marks run end, finalizes message |
| `RUN_ERROR` | `message`, `code?` | Creates error message with inline Alert |

### Text Messages

| Event | Fields | Description |
|-------|--------|-------------|
| `TEXT_MESSAGE_START` | `messageId`, `role` | Creates new text block in contentBlocks |
| `TEXT_MESSAGE_CONTENT` | `messageId`, `delta` | Appends text delta to current block |
| `TEXT_MESSAGE_END` | `messageId` | Closes current text block |

### Tool Calls

| Event | Fields | Description |
|-------|--------|-------------|
| `TOOL_CALL_START` | `toolCallId`, `toolCallName`, `parentMessageId?` | Creates ToolCall, shows spinner |
| `TOOL_CALL_ARGS` | `toolCallId`, `delta` | Appends JSON args delta |
| `TOOL_CALL_END` | `toolCallId` | Marks args complete |
| `TOOL_CALL_RESULT` | `toolCallId`, `content` | Sets result, hides spinner |

### Steps

| Event | Fields | Description |
|-------|--------|-------------|
| `STEP_STARTED` | `stepName`, `stepId?` | Creates step with 'in-progress' status |
| `STEP_FINISHED` | `stepName`, `stepId?` | Sets step status to 'done' |

### Unused Events

These are defined but not currently processed: `STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT`, `RAW`.

## State Management

### React State

```typescript
const [messages, setMessages]     // ChatMessage[] - triggers re-renders
const [isStreaming, setIsStreaming]  // Request in-flight
const [runActive, setRunActive]      // Run lifecycle status
const [error, setError]              // Top-level error
```

### Internal Refs (no re-renders)

```typescript
currentMessageRef      // ChatMessage being built
toolCallsRef           // Map<string, ToolCall>
stepsRef               // Map<string, Step>
contentBlocksRef       // ContentBlock[] - ordered elements
currentTextBlockIdRef  // Active text block ID
hasStepsBlockRef       // Boolean - steps block added
hasToolsBlockRef       // Boolean - tools block added
```

**Why refs?** SSE events arrive rapidly (character-by-character). Using refs avoids excessive re-renders during streaming. State is committed via `updateCurrentMessage()` after meaningful changes.

## Data Structures

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  steps?: Step[];
  contentBlocks?: ContentBlock[];
  error?: { title: string; body: string };
}
```

### ContentBlock

Preserves the order of mixed content types:

```typescript
type ContentBlock =
  | { type: 'text'; id: string; content: string }
  | { type: 'steps'; id: 'steps' }
  | { type: 'tools'; id: 'tools' };
```

Example sequence for interleaved events:
```
TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT("Hello") → STEP_STARTED → TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT("More") → TOOL_CALL_START
```

Results in:
```typescript
contentBlocks = [
  { type: 'text', id: 'text-1', content: 'Hello' },
  { type: 'steps', id: 'steps' },
  { type: 'text', id: 'text-2', content: 'More' },
  { type: 'tools', id: 'tools' }
]
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  name: string;
  args: string;      // Accumulated JSON string
  result?: string;
  isLoading: boolean;
}
```

### Step

```typescript
interface Step {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'done';
}
```

## Event Processing Details

### handleEvent() (useAgUiStream.ts)

The main event dispatcher processes each SSE event:

```typescript
switch (event.type) {
  case 'RUN_STARTED':
    setRunActive(true);
    break;

  case 'TEXT_MESSAGE_START':
    // Create new text block, add to contentBlocksRef
    break;

  case 'TEXT_MESSAGE_CONTENT':
    // Append delta to current text block content
    break;

  case 'TOOL_CALL_START':
    // Create ToolCall in toolCallsRef
    // Add 'tools' block to contentBlocksRef if first tool
    break;

  case 'TOOL_CALL_ARGS':
    // Append delta to toolCall.args
    break;

  case 'TOOL_CALL_RESULT':
    // Set toolCall.result, isLoading = false
    break;

  case 'STEP_STARTED':
    // Create Step in stepsRef
    // Add 'steps' block to contentBlocksRef if first step
    break;

  case 'STEP_FINISHED':
    // Set step.status = 'done'
    break;

  case 'RUN_FINISHED':
    // Clear all refs, finalize message
    break;

  case 'RUN_ERROR':
    // Create error message with title/body
    break;
}
```

### updateCurrentMessage()

Commits ref state to React state:

```typescript
function updateCurrentMessage() {
  setMessages(prev => {
    const updated = [...prev];
    const lastIndex = updated.length - 1;
    updated[lastIndex] = {
      ...currentMessageRef.current,
      toolCalls: Array.from(toolCallsRef.current.values()),
      steps: Array.from(stepsRef.current.values()),
      contentBlocks: [...contentBlocksRef.current],
    };
    return updated;
  });
}
```

## UI Rendering

### MessageList.tsx

Renders `ChatMessage[]` using PatternFly `Message` components:

1. **User messages**: Render content directly
2. **Assistant messages with contentBlocks**: Use `ContentBlockRenderer`
3. **Empty streaming assistant**: Show loading spinner
4. **Error messages**: Render inline PatternFly Alert

### ContentBlockRenderer

Iterates `contentBlocks[]` in order:

```tsx
{contentBlocks.map(block => {
  switch (block.type) {
    case 'text':
      return <TextWithCharts content={block.content} toolCalls={toolCalls} />;
    case 'steps':
      return <StepsList steps={steps} />;
    case 'tools':
      return <ToolCallsList toolCalls={toolCalls} />;
  }
})}
```

### TextWithCharts

Parses text for chart placeholders and renders embedded charts:

1. Splits content by `<<{...}>>` placeholders
2. Renders text segments as `MarkdownContent` (PatternFly)
3. For `promql` placeholders, looks up tool call by ID and renders `TimeSeriesChart`

### StepsList

Renders PatternFly `ProgressStepper`:
- `done` status → CheckCircle icon, success variant
- `in-progress` status → InProgress icon
- `pending` status → OutlinedCircle icon

### ToolCallsList / ToolCallItem

Renders PatternFly `ToolResponse` (collapsible):
- Tool name with spinner while `isLoading`
- **Parameters**: Code block with JSON args
- **Response**: Code block with result
- Collapsed by default (user expands to see details)
- Max-height 200px with scroll to prevent layout explosion

### Markdown Rendering

Uses PatternFly's `MarkdownContent` component which provides:
- GFM (GitHub Flavored Markdown) support including tables
- Syntax highlighting for code blocks
- Consistent PatternFly styling

## Error Handling

### RUN_ERROR Event

```typescript
case 'RUN_ERROR':
  const errorMessage: ChatMessage = {
    id: `error-${Date.now()}`,
    role: 'assistant',
    content: '',
    error: {
      title: 'Error',
      body: event.message,
    },
  };
  setMessages(prev => [...prev, errorMessage]);
```

Rendered as inline Alert:

```tsx
{message.error && (
  <Alert variant="danger" title={message.error.title}>
    {message.error.body}
  </Alert>
)}
```

### Network Errors

Caught in `sendMessage()` catch block:
- Creates error message with "Request Failed" title
- Sets top-level error state
- Clears streaming state

### Parse Errors

SSE parse failures are logged to console and skipped:
```typescript
try {
  const event = JSON.parse(data);
  handleEvent(event);
} catch {
  console.warn('[AG-UI] Failed to parse event:', data);
}
```

## SSE Parsing

The streaming response is parsed line-by-line:

```typescript
const reader = response.body.getReader();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';  // Keep incomplete line

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      handleEvent(JSON.parse(data));
    }
  }
}
```

## Demo Mode

When demo mode is enabled (toggle in UI header, persisted in localStorage as `app-mode`), `simulateAgUiStream()` generates events locally:

- Parses special commands: `step`, `tool`, `text`, `code`, `error`
- Streams text character-by-character (15ms delay)
- Simulates tool calls with args and results
- Simulates step progression (600ms per step)

Example demo commands:
```
step              → Simulates 3 steps
tool              → Simulates tool call with args/result
text hello        → Streams "hello"
code console.log  → Streams code block
error             → Simulates RUN_ERROR
```
