import { useState, useCallback } from 'react'
import { ChatWindow } from './components/ChatWindow'
import { useAgUiStream } from './hooks/useAgUiStream'
import type { ChatMessage, ToolCall, Step, ContentBlock } from './types/agui'

const MODE_STORAGE_KEY = 'app-mode'

function getStoredMode(): boolean {
  const stored = localStorage.getItem(MODE_STORAGE_KEY)
  // Default to demo mode if not set
  return stored !== 'prod'
}

function App() {
  // Demo/Prod mode toggle
  const [isDemoMode, setIsDemoMode] = useState<boolean>(getStoredMode)

  const toggleMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const newMode = !prev
      localStorage.setItem(MODE_STORAGE_KEY, newMode ? 'demo' : 'prod')
      return newMode
    })
  }, [])

  // Real ag-ui streaming hook
  const agUi = useAgUiStream({ endpoint: '/api/agui/chat' })

  // Demo state for testing without backend
  const [demoMessages, setDemoMessages] = useState<ChatMessage[]>([])
  const [demoStreaming, setDemoStreaming] = useState(false)
  const [demoRunActive, setDemoRunActive] = useState(false)

  const simulateAgUiStream = useCallback(async (userContent: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
    }
    setDemoMessages((prev) => [...prev, userMessage])
    setDemoStreaming(true)
    setDemoRunActive(true)

    // Simulate assistant response with streaming
    const assistantId = `assistant-${Date.now()}`
    const contentBlocks: ContentBlock[] = []
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
      steps: [],
      contentBlocks: [],
    }
    setDemoMessages((prev) => [...prev, assistantMessage])

    // Helper to update the last message
    const updateMessage = (updates: Partial<ChatMessage>) => {
      setDemoMessages((prev) => {
        const last = prev[prev.length - 1]
        return [...prev.slice(0, -1), { ...last, ...updates }]
      })
    }

    // Simulate steps with pending -> in-progress -> done transitions
    // Steps arrive FIRST, so add steps block at the beginning
    contentBlocks.push({ type: 'steps', id: 'steps' })
    const steps: Step[] = [
      { id: 'step-1', name: 'Analyzing query', status: 'pending' },
      { id: 'step-2', name: 'Gathering context', status: 'pending' },
      { id: 'step-3', name: 'Generating response', status: 'pending' },
    ]

    for (let i = 0; i < steps.length; i++) {
      // Mark current step as in-progress
      steps[i].status = 'in-progress'
      updateMessage({ steps: [...steps], contentBlocks: [...contentBlocks] })
      await delay(800)
      // Mark current step as done
      steps[i].status = 'done'
      updateMessage({ steps: [...steps], contentBlocks: [...contentBlocks] })
      await delay(200)
    }

    // Simulate tool call - add tools block after steps
    contentBlocks.push({ type: 'tools', id: 'tools' })
    const toolCall: ToolCall = {
      id: 'tool-1',
      name: 'get_cluster_metrics',
      args: '',
      isLoading: true,
    }
    updateMessage({ toolCalls: [toolCall], contentBlocks: [...contentBlocks] })
    await delay(400)

    // Stream tool arguments
    const argsText = '{"cluster": "prod-east", "metric": "cpu_usage"}'
    for (const char of argsText) {
      toolCall.args += char
      updateMessage({ toolCalls: [{ ...toolCall }], contentBlocks: [...contentBlocks] })
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
    updateMessage({ toolCalls: [{ ...toolCall }], contentBlocks: [...contentBlocks] })
    await delay(300)

    // Stream the response text - add text block AFTER steps and tools
    const textBlockId = `text-${Date.now()}`
    contentBlocks.push({ type: 'text', id: textBlockId, content: '' })
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
      // Update the text block content
      const textBlock = contentBlocks.find((b): b is ContentBlock & { type: 'text' } => b.type === 'text' && b.id === textBlockId)
      if (textBlock) {
        textBlock.content = currentContent
      }
      updateMessage({ content: currentContent, contentBlocks: [...contentBlocks] })
      await delay(15)
    }

    // End streaming
    updateMessage({ isStreaming: false })
    setDemoRunActive(false)
    setDemoStreaming(false)
  }, [])

  const handleSendMessage = isDemoMode
    ? simulateAgUiStream
    : agUi.sendMessage

  const handleClearMessages = isDemoMode
    ? () => setDemoMessages([])
    : agUi.clearMessages

  const messages = isDemoMode ? demoMessages : agUi.messages
  const isStreaming = isDemoMode ? demoStreaming : agUi.isStreaming
  const runActive = isDemoMode ? demoRunActive : agUi.runActive
  const error = isDemoMode ? null : agUi.error

  return (
    <ChatWindow
      messages={messages}
      isStreaming={isStreaming}
      runActive={runActive}
      error={error}
      onSendMessage={handleSendMessage}
      onClearMessages={handleClearMessages}
      isDemoMode={isDemoMode}
      onToggleMode={toggleMode}
    />
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default App
