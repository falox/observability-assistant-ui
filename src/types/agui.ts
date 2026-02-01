/**
 * ag-ui Protocol Types
 *
 * Event types are imported from @ag-ui/core.
 * UI-specific types (ChatMessage, Step, ContentBlock, etc.) are defined here.
 */

// Re-export event types from @ag-ui/core
export {
  EventType,
  type BaseEvent,
  type RunStartedEvent,
  type RunFinishedEvent,
  type RunErrorEvent,
  type TextMessageStartEvent,
  type TextMessageContentEvent,
  type TextMessageEndEvent,
  type ToolCallStartEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallResultEvent,
  type StepStartedEvent,
  type StepFinishedEvent,
  type CustomEvent,
  type Message,
  type State,
  type RunAgentInput,
} from '@ag-ui/core'

// Content block types for ordered rendering
export type ContentBlock =
  | { type: 'text'; id: string; content: string }
  | { type: 'steps'; id: string } // Steps are stored separately and referenced here
  | { type: 'tools'; id: string } // Tool calls are stored separately and referenced here

// Error info for displaying error messages
export interface MessageError {
  title: string
  body?: string
}

// Chat message types for UI state
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  displayName?: string // Custom display name from backend (e.g., "Prometheus Expert")
  isStreaming?: boolean
  toolCalls?: ToolCall[]
  steps?: Step[]
  contentBlocks?: ContentBlock[] // Ordered list of content blocks for rendering
  error?: MessageError // Error to display instead of content
}

// Extended RUN_STARTED event with custom displayName field
export interface ExtendedRunStartedEvent {
  type: 'RUN_STARTED'
  threadId: string
  runId: string
  displayName?: string // Custom field: backend can specify display name (e.g., "Prometheus Expert")
}

export interface ToolCall {
  id: string
  name: string
  args: string
  result?: string
  isLoading?: boolean
}

export interface Step {
  id: string
  name: string
  status: 'pending' | 'in-progress' | 'done' | 'failed'
  activeForm?: string // Display text while step is in progress
}

// Custom event payload for step updates
export interface StepUpdatePayload {
  stepName: string
  status: 'in_progress' | 'failed'
  activeForm: string
}
