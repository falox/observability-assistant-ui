import { useState, useCallback, useRef, useMemo } from 'react'
import { HttpAgent, type AgentSubscriber } from '@ag-ui/client'
import type { ChatMessage, ToolCall, Step, ContentBlock, StepUpdatePayload } from '../types/agui'

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

  const currentMessageRef = useRef<ChatMessage | null>(null)
  const toolCallsRef = useRef<Map<string, ToolCall>>(new Map())
  const stepsRef = useRef<Map<string, Step>>(new Map())
  const contentBlocksRef = useRef<ContentBlock[]>([])
  const currentTextBlockIdRef = useRef<string | null>(null)
  const hasStepsBlockRef = useRef(false)
  const hasToolsBlockRef = useRef(false)

  // Create HttpAgent instance with a unique threadId
  const agent = useMemo(() => {
    return new HttpAgent({
      url: endpoint,
      threadId: `thread-${Date.now()}`,
    })
  }, [endpoint])

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
        contentBlocks: [],
      }
      currentMessageRef.current = newMessage
      toolCallsRef.current.clear()
      stepsRef.current.clear()
      contentBlocksRef.current = []
      currentTextBlockIdRef.current = null
      hasStepsBlockRef.current = false
      hasToolsBlockRef.current = false
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

  // Create subscriber for handling ag-ui events
  const createSubscriber = useCallback((): AgentSubscriber => {
    // Status priority for step updates
    const statusPriority: Record<string, number> = {
      'pending': 0,
      'in-progress': 1,
      'done': 2,
      'failed': 3,
    }

    return {
    onRunStartedEvent: () => {
      setRunActive(true)
    },

    onTextMessageStartEvent: () => {
      ensureAssistantMessage()
      // Create a new text block
      const textBlockId = `text-${Date.now()}`
      currentTextBlockIdRef.current = textBlockId
      contentBlocksRef.current.push({ type: 'text', id: textBlockId, content: '' })
      updateCurrentMessage({
        contentBlocks: [...contentBlocksRef.current],
      })
    },

    onTextMessageContentEvent: ({ event }) => {
      ensureAssistantMessage()
      // Update the current text block content
      const textBlockId = currentTextBlockIdRef.current
      if (textBlockId) {
        const textBlock = contentBlocksRef.current.find(
          (b): b is ContentBlock & { type: 'text' } => b.type === 'text' && b.id === textBlockId
        )
        if (textBlock) {
          textBlock.content += event.delta
        }
      }
      updateCurrentMessage({
        content: (currentMessageRef.current?.content || '') + event.delta,
        contentBlocks: [...contentBlocksRef.current],
      })
    },

    onTextMessageEndEvent: () => {
      // End the current text block, but keep the message and refs active
      currentTextBlockIdRef.current = null
    },

    onToolCallStartEvent: ({ event }) => {
      ensureAssistantMessage()
      // Add tools block if this is the first tool call
      if (!hasToolsBlockRef.current) {
        hasToolsBlockRef.current = true
        contentBlocksRef.current.push({ type: 'tools', id: 'tools' })
      }
      const toolCall: ToolCall = {
        id: event.toolCallId,
        name: event.toolCallName,
        args: '',
        isLoading: true,
      }
      toolCallsRef.current.set(event.toolCallId, toolCall)
      updateCurrentMessage({
        toolCalls: Array.from(toolCallsRef.current.values()),
        contentBlocks: [...contentBlocksRef.current],
      })
    },

    onToolCallArgsEvent: ({ event }) => {
      const toolCall = toolCallsRef.current.get(event.toolCallId)
      if (toolCall) {
        toolCall.args += event.delta
        updateCurrentMessage({
          toolCalls: Array.from(toolCallsRef.current.values()),
        })
      }
    },

    onToolCallEndEvent: ({ event }) => {
      const toolCall = toolCallsRef.current.get(event.toolCallId)
      if (toolCall) {
        toolCall.isLoading = false
        updateCurrentMessage({
          toolCalls: Array.from(toolCallsRef.current.values()),
        })
      }
    },

    onToolCallResultEvent: ({ event }) => {
      const toolCall = toolCallsRef.current.get(event.toolCallId)
      if (toolCall) {
        toolCall.result = event.content
        toolCall.isLoading = false
        updateCurrentMessage({
          toolCalls: Array.from(toolCallsRef.current.values()),
        })
      }
    },

    onStepStartedEvent: ({ event }) => {
      ensureAssistantMessage()
      // Add steps block if this is the first step
      if (!hasStepsBlockRef.current) {
        hasStepsBlockRef.current = true
        contentBlocksRef.current.push({ type: 'steps', id: 'steps' })
      }
      // Use stepName as the step ID
      const stepId = event.stepName
      const existingStep = stepsRef.current.get(stepId)

      if (!existingStep) {
        // Create new step with 'pending' status
        const step: Step = {
          id: stepId,
          name: event.stepName,
          status: 'pending',
        }
        stepsRef.current.set(stepId, step)
        updateCurrentMessage({
          steps: Array.from(stepsRef.current.values()),
          contentBlocks: [...contentBlocksRef.current],
        })
      }
    },

    onStepFinishedEvent: ({ event }) => {
      // Use stepName as the step ID
      const stepId = event.stepName
      let step = stepsRef.current.get(stepId)

      // Create step if it doesn't exist (tolerate out-of-order events)
      if (!step) {
        ensureAssistantMessage()
        if (!hasStepsBlockRef.current) {
          hasStepsBlockRef.current = true
          contentBlocksRef.current.push({ type: 'steps', id: 'steps' })
        }
        step = {
          id: stepId,
          name: event.stepName,
          status: 'pending',
        }
        stepsRef.current.set(stepId, step)
      }

      // Only update to 'done' if current status has lower priority
      const currentPriority = statusPriority[step.status] ?? 0
      const donePriority = statusPriority['done']

      if (donePriority >= currentPriority) {
        step.status = 'done'
        step.activeForm = undefined
        updateCurrentMessage({
          steps: Array.from(stepsRef.current.values()),
          contentBlocks: [...contentBlocksRef.current],
        })
      }
    },

    onCustomEvent: ({ event }) => {
      // Handle step_update custom event
      if (event.name === 'step_update') {
        const { stepName, status, activeForm } = event.value as StepUpdatePayload
        const stepId = stepName
        let step = stepsRef.current.get(stepId)

        // Create step if it doesn't exist
        if (!step) {
          ensureAssistantMessage()
          if (!hasStepsBlockRef.current) {
            hasStepsBlockRef.current = true
            contentBlocksRef.current.push({ type: 'steps', id: 'steps' })
          }
          step = {
            id: stepId,
            name: stepName,
            status: 'pending',
          }
          stepsRef.current.set(stepId, step)
        }

        const newStatus = status === 'in_progress' ? 'in-progress' : status
        const currentPriority = statusPriority[step.status] ?? 0
        const newPriority = statusPriority[newStatus] ?? 0

        if (newPriority >= currentPriority) {
          step.status = newStatus as Step['status']
          step.activeForm = activeForm || undefined
          updateCurrentMessage({
            steps: Array.from(stepsRef.current.values()),
            contentBlocks: [...contentBlocksRef.current],
          })
        }
      }
    },

    onRunErrorEvent: ({ event }) => {
      ensureAssistantMessage()
      updateCurrentMessage({
        isStreaming: false,
        error: {
          title: 'Error',
          body: event.message,
        },
      })
      // Reset refs for next run
      currentMessageRef.current = null
      toolCallsRef.current.clear()
      stepsRef.current.clear()
      contentBlocksRef.current = []
      currentTextBlockIdRef.current = null
      hasStepsBlockRef.current = false
      hasToolsBlockRef.current = false
      setError(event.message)
      setRunActive(false)
      setIsStreaming(false)
    },

    onRunFinishedEvent: () => {
      // Finalize the current message and reset for next run
      updateCurrentMessage({ isStreaming: false })
      currentMessageRef.current = null
      toolCallsRef.current.clear()
      stepsRef.current.clear()
      contentBlocksRef.current = []
      currentTextBlockIdRef.current = null
      hasStepsBlockRef.current = false
      hasToolsBlockRef.current = false
      setRunActive(false)
      setIsStreaming(false)
    },
  }}, [ensureAssistantMessage, updateCurrentMessage])

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

      try {
        // Prepare messages for ag-ui format
        const agUiMessages = [...messages, userMessage].map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))

        // Set messages on agent
        agent.setMessages(agUiMessages)

        const runId = `run-${Date.now()}`

        // Log what will be sent (HttpAgent builds the full request internally)
        console.log('[AG-UI] OUT:', JSON.stringify({
          threadId: agent.threadId,
          runId,
          messages: agUiMessages,
          state: agent.state,
          tools: [],
          context: [],
          forwardedProps: {},
        }))

        // Create subscriber and run agent
        const subscriber = createSubscriber()

        await agent.runAgent(
          {
            runId,
            tools: [],
            context: [],
            forwardedProps: {},
          },
          {
            ...subscriber,
            // Log all events
            onEvent: (params) => {
              console.log('[AG-UI] IN:', JSON.stringify(params.event))
            },
          }
        )
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          ensureAssistantMessage()
          updateCurrentMessage({
            isStreaming: false,
            error: {
              title: 'Request Failed',
              body: err.message,
            },
          })
          // Reset refs for next run
          currentMessageRef.current = null
          toolCallsRef.current.clear()
          stepsRef.current.clear()
          contentBlocksRef.current = []
          currentTextBlockIdRef.current = null
          hasStepsBlockRef.current = false
          hasToolsBlockRef.current = false
          setError(err.message)
          setRunActive(false)
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [agent, messages, createSubscriber, ensureAssistantMessage, updateCurrentMessage]
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
