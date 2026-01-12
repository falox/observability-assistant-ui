import { useState, useCallback } from 'react'
import { ChatWindow } from './components/ChatWindow'
import { useAgUiStream } from './hooks/useAgUiStream'
import type { ChatMessage, ToolCall, Step } from './types/agui'

// Demo mode: simulate ag-ui events for testing UI without a backend
const DEMO_MODE = false

function App() {
  // Real ag-ui streaming hook
  const agUi = useAgUiStream({ endpoint: '/api/agui/chat' })

  // Demo state for testing without backend
  const [demoMessages, setDemoMessages] = useState<ChatMessage[]>([])
  const [demoStreaming, setDemoStreaming] = useState(false)

  const simulateAgUiStream = useCallback(async (userContent: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
    }
    setDemoMessages((prev) => [...prev, userMessage])
    setDemoStreaming(true)

    // Simulate assistant response with streaming
    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
      steps: [],
    }
    setDemoMessages((prev) => [...prev, assistantMessage])

    // Helper to update the last message
    const updateMessage = (updates: Partial<ChatMessage>) => {
      setDemoMessages((prev) => {
        const last = prev[prev.length - 1]
        return [...prev.slice(0, -1), { ...last, ...updates }]
      })
    }

    // Simulate steps
    const steps: Step[] = [
      { id: 'step-1', name: 'Analyzing query', isComplete: false },
      { id: 'step-2', name: 'Gathering context', isComplete: false },
      { id: 'step-3', name: 'Generating response', isComplete: false },
    ]

    for (const step of steps) {
      updateMessage({ steps: [...steps.filter(s => s.id <= step.id)] })
      await delay(500)
      step.isComplete = true
      updateMessage({ steps: [...steps] })
      await delay(300)
    }

    // Simulate tool call
    const toolCall: ToolCall = {
      id: 'tool-1',
      name: 'get_cluster_metrics',
      args: '',
      isLoading: true,
    }
    updateMessage({ toolCalls: [toolCall] })
    await delay(400)

    // Stream tool arguments
    const argsText = '{"cluster": "prod-east", "metric": "cpu_usage"}'
    for (const char of argsText) {
      toolCall.args += char
      updateMessage({ toolCalls: [{ ...toolCall }] })
      await delay(20)
    }
    await delay(500)

    // Tool result
    toolCall.isLoading = false
    toolCall.result = JSON.stringify({
      cpu_usage: '45%',
      memory_usage: '62%',
      pod_count: 128,
      node_status: 'healthy',
    }, null, 2)
    updateMessage({ toolCalls: [{ ...toolCall }] })
    await delay(300)

    // Stream the response text
    const responseText = `## Cluster Status

Based on the metrics from **prod-east** cluster:

| Metric | Value |
|--------|-------|
| CPU Usage | 45% |
| Memory Usage | 62% |
| Pod Count | 128 |
| Node Status | Healthy |

### Summary

The cluster is operating normally. CPU and memory usage are within acceptable limits.

\`\`\`yaml
cluster:
  name: prod-east
  status: healthy
  alerts: 0
\`\`\`

Would you like me to check any specific pods or services?`

    let currentContent = ''
    for (const char of responseText) {
      currentContent += char
      updateMessage({ content: currentContent })
      await delay(15)
    }

    // End streaming
    updateMessage({ isStreaming: false })
    setDemoStreaming(false)
  }, [])

  const handleSendMessage = DEMO_MODE
    ? simulateAgUiStream
    : agUi.sendMessage

  const handleClearMessages = DEMO_MODE
    ? () => setDemoMessages([])
    : agUi.clearMessages

  const messages = DEMO_MODE ? demoMessages : agUi.messages
  const isStreaming = DEMO_MODE ? demoStreaming : agUi.isStreaming
  const error = DEMO_MODE ? null : agUi.error

  return (
    <ChatWindow
      messages={messages}
      isStreaming={isStreaming}
      error={error}
      onSendMessage={handleSendMessage}
      onClearMessages={handleClearMessages}
    />
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default App
