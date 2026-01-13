import { useState, useCallback, useRef } from 'react'
import type { AgUiEvent, ChatMessage, ToolCall, Step } from '../types/agui'

interface UseAgUiStreamOptions {
  endpoint?: string
}

interface UseAgUiStreamReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  runActive: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
}

export function useAgUiStream(
  options: UseAgUiStreamOptions = {}
): UseAgUiStreamReturn {
  const { endpoint = '/api/chat' } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [runActive, setRunActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const currentMessageRef = useRef<ChatMessage | null>(null)
  const toolCallsRef = useRef<Map<string, ToolCall>>(new Map())
  const stepsRef = useRef<Map<string, Step>>(new Map())

  // Ensures an assistant message exists, creating one if needed
  const ensureAssistantMessage = useCallback(() => {
    if (!currentMessageRef.current) {
      const newMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        isStreaming: true,
        toolCalls: [],
        steps: [],
      }
      currentMessageRef.current = newMessage
      toolCallsRef.current.clear()
      stepsRef.current.clear()
      setMessages((prev) => [...prev, newMessage])
    }
  }, [])

  const updateCurrentMessage = useCallback((updates: Partial<ChatMessage>) => {
    if (!currentMessageRef.current) return

    currentMessageRef.current = {
      ...currentMessageRef.current,
      ...updates,
    }

    const updatedMessage = { ...currentMessageRef.current }

    setMessages((prev) => {
      // Find the message by ID, not by position
      const messageIndex = prev.findIndex((m) => m.id === updatedMessage.id)
      if (messageIndex === -1) {
        // Message not in state yet, add it
        return [...prev, updatedMessage]
      }
      return [
        ...prev.slice(0, messageIndex),
        updatedMessage,
        ...prev.slice(messageIndex + 1),
      ]
    })
  }, [])

  const handleEvent = useCallback(
    (event: AgUiEvent) => {
      switch (event.type) {
        case 'RUN_STARTED': {
          setRunActive(true)
          break
        }

        case 'TEXT_MESSAGE_START': {
          // Always create a new message for each TEXT_MESSAGE_START
          // This ensures each text block gets its own "balloon"
          ensureAssistantMessage()
          break
        }

        case 'TEXT_MESSAGE_CONTENT': {
          ensureAssistantMessage()
          updateCurrentMessage({
            content: (currentMessageRef.current?.content || '') + event.delta,
          })
          break
        }

        case 'TEXT_MESSAGE_END': {
          // Finalize current message and allow a new one to be created
          // This ensures each text message block gets its own "balloon"
          if (currentMessageRef.current) {
            updateCurrentMessage({ isStreaming: false })
            currentMessageRef.current = null
            toolCallsRef.current.clear()
            stepsRef.current.clear()
          }
          break
        }

        case 'TOOL_CALL_START': {
          ensureAssistantMessage()
          const toolCall: ToolCall = {
            id: event.toolCallId,
            name: event.toolCallName,
            args: '',
            isLoading: true,
          }
          toolCallsRef.current.set(event.toolCallId, toolCall)
          updateCurrentMessage({
            toolCalls: Array.from(toolCallsRef.current.values()),
          })
          break
        }

        case 'TOOL_CALL_ARGS': {
          const toolCall = toolCallsRef.current.get(event.toolCallId)
          if (toolCall) {
            toolCall.args += event.delta
            updateCurrentMessage({
              toolCalls: Array.from(toolCallsRef.current.values()),
            })
          }
          break
        }

        case 'TOOL_CALL_END': {
          const toolCall = toolCallsRef.current.get(event.toolCallId)
          if (toolCall) {
            toolCall.isLoading = false
            updateCurrentMessage({
              toolCalls: Array.from(toolCallsRef.current.values()),
            })
          }
          break
        }

        case 'TOOL_CALL_RESULT': {
          const toolCall = toolCallsRef.current.get(event.toolCallId)
          if (toolCall) {
            toolCall.result = event.content
            toolCall.isLoading = false
            updateCurrentMessage({
              toolCalls: Array.from(toolCallsRef.current.values()),
            })
          }
          break
        }

        case 'STEP_STARTED': {
          ensureAssistantMessage()
          const step: Step = {
            id: event.stepId || event.stepName,
            name: event.stepName,
            isComplete: false,
          }
          stepsRef.current.set(step.id, step)
          updateCurrentMessage({
            steps: Array.from(stepsRef.current.values()),
          })
          break
        }

        case 'STEP_FINISHED': {
          const stepId = event.stepId || event.stepName
          const step = stepsRef.current.get(stepId)
          if (step) {
            step.isComplete = true
            updateCurrentMessage({
              steps: Array.from(stepsRef.current.values()),
            })
          }
          break
        }

        case 'RUN_ERROR': {
          setError(event.message)
          setRunActive(false)
          setIsStreaming(false)
          break
        }

        case 'RUN_FINISHED': {
          // Finalize the current message and reset for next run
          updateCurrentMessage({ isStreaming: false })
          currentMessageRef.current = null
          toolCallsRef.current.clear()
          stepsRef.current.clear()
          setRunActive(false)
          setIsStreaming(false)
          break
        }
      }
    },
    [ensureAssistantMessage, updateCurrentMessage]
  )

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      }
      setMessages((prev) => [...prev, userMessage])

      setIsStreaming(true)
      setError(null)

      abortControllerRef.current = new AbortController()

      try {
        const requestBody = {
          threadId: `thread-${Date.now()}`,
          runId: `run-${Date.now()}`,
          messages: [...messages, userMessage].map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
          state: {},
          tools: [],
          context: [],
          forwardedProps: {},
        }
        console.log('[AG-UI] OUT:', requestBody)

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE events
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const event = JSON.parse(data) as AgUiEvent
                console.log('[AG-UI] IN:', event)
                handleEvent(event)
              } catch {
                console.warn('[AG-UI] Failed to parse event:', data)
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [endpoint, messages, handleEvent]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    currentMessageRef.current = null
    toolCallsRef.current.clear()
    stepsRef.current.clear()
  }, [])

  return {
    messages,
    isStreaming,
    runActive,
    error,
    sendMessage,
    clearMessages,
  }
}
