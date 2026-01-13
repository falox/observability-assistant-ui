/**
 * ag-ui Protocol Event Types
 * Based on: https://github.com/ag-ui-protocol/ag-ui
 */

export type AgUiEventType =
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_ARGS'
  | 'TOOL_CALL_END'
  | 'TOOL_CALL_RESULT'
  | 'STEP_STARTED'
  | 'STEP_FINISHED'
  | 'STATE_SNAPSHOT'
  | 'STATE_DELTA'
  | 'MESSAGES_SNAPSHOT'
  | 'RAW'

export interface BaseEvent {
  type: AgUiEventType
  timestamp?: number
}

export interface RunStartedEvent extends BaseEvent {
  type: 'RUN_STARTED'
  runId: string
  threadId?: string
}

export interface RunFinishedEvent extends BaseEvent {
  type: 'RUN_FINISHED'
  runId: string
}

export interface RunErrorEvent extends BaseEvent {
  type: 'RUN_ERROR'
  message: string
  code?: string
}

export interface TextMessageStartEvent extends BaseEvent {
  type: 'TEXT_MESSAGE_START'
  messageId: string
  role: 'assistant' | 'user'
}

export interface TextMessageContentEvent extends BaseEvent {
  type: 'TEXT_MESSAGE_CONTENT'
  messageId: string
  delta: string
}

export interface TextMessageEndEvent extends BaseEvent {
  type: 'TEXT_MESSAGE_END'
  messageId: string
}

export interface ToolCallStartEvent extends BaseEvent {
  type: 'TOOL_CALL_START'
  toolCallId: string
  toolCallName: string
  parentMessageId?: string
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: 'TOOL_CALL_ARGS'
  toolCallId: string
  delta: string
}

export interface ToolCallEndEvent extends BaseEvent {
  type: 'TOOL_CALL_END'
  toolCallId: string
}

export interface ToolCallResultEvent extends BaseEvent {
  type: 'TOOL_CALL_RESULT'
  toolCallId: string
  result: string
}

export interface StepStartedEvent extends BaseEvent {
  type: 'STEP_STARTED'
  stepName: string
  stepId?: string
}

export interface StepFinishedEvent extends BaseEvent {
  type: 'STEP_FINISHED'
  stepName: string
  stepId?: string
}

export type AgUiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StepStartedEvent
  | StepFinishedEvent

// Chat message types for UI state
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolCalls?: ToolCall[]
  steps?: Step[]
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
  isComplete: boolean
}
