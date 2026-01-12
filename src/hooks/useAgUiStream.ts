import { useState, useCallback, useRef } from 'react'
import type { AgUiEvent, ChatMessage, ToolCall, Step } from '../types/agui'

interface UseAgUiStreamOptions {
  endpoint?: string
}

interface UseAgUiStreamReturn {
  messages: ChatMessage[]
  isStreaming: boolean
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
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const currentMessageRef = useRef<ChatMessage | null>(null)
  const toolCallsRef = useRef<Map<string, ToolCall>>(new Map())
  const stepsRef = useRef<Map<string, Step>>(new Map())

  const updateCurrentMessage = useCallback((updates: Partial<ChatMessage>) => {
    if (!currentMessageRef.current) return

    currentMessageRef.current = {
      ...currentMessageRef.current,
      ...updates,
    }

    setMessages((prev) => {
      const lastIndex = prev.length - 1
      if (lastIndex < 0) return prev
      return [
        ...prev.slice(0, lastIndex),
        { ...currentMessageRef.current! },
      ]
    })
  }, [])

  const handleEvent = useCallback(
    (event: AgUiEvent) => {
      switch (event.type) {
        case 'TEXT_MESSAGE_START': {
          const newMessage: ChatMessage = {
            id: event.messageId,
            role: event.role === 'assistant' ? 'assistant' : 'user',
            content: '',
            isStreaming: true,
            toolCalls: [],
            steps: [],
          }
          currentMessageRef.current = newMessage
          toolCallsRef.current.clear()
          stepsRef.current.clear()
          setMessages((prev) => [...prev, newMessage])
          break
        }

        case 'TEXT_MESSAGE_CONTENT': {
          if (currentMessageRef.current) {
            updateCurrentMessage({
              content: currentMessageRef.current.content + event.delta,
            })
          }
          break
        }

        case 'TEXT_MESSAGE_END': {
          updateCurrentMessage({ isStreaming: false })
          currentMessageRef.current = null
          break
        }

        case 'TOOL_CALL_START': {
          const toolCall: ToolCall = {
            id: event.toolCallId,
            name: event.toolName,
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
            toolCall.result = event.result
            toolCall.isLoading = false
            updateCurrentMessage({
              toolCalls: Array.from(toolCallsRef.current.values()),
            })
          }
          break
        }

        case 'STEP_STARTED': {
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
          setIsStreaming(false)
          break
        }

        case 'RUN_FINISHED': {
          setIsStreaming(false)
          break
        }
      }
    },
    [updateCurrentMessage]
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
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
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
                handleEvent(event)
              } catch {
                console.warn('Failed to parse event:', data)
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
    error,
    sendMessage,
    clearMessages,
  }
}
