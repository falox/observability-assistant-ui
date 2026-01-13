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
    const toolCalls: ToolCall[] = []
    const steps: Step[] = []
    let fullContent = ''
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

    // Helper to stream text
    const streamText = async (text: string) => {
      const textBlockId = `text-${Date.now()}`
      contentBlocks.push({ type: 'text', id: textBlockId, content: '' })
      for (const char of text) {
        fullContent += char
        const textBlock = contentBlocks.find((b): b is ContentBlock & { type: 'text' } => b.type === 'text' && b.id === textBlockId)
        if (textBlock) {
          textBlock.content += char
        }
        updateMessage({ content: fullContent, contentBlocks: [...contentBlocks] })
        await delay(15)
      }
    }

    // Helper to simulate steps
    const simulateSteps = async (stepNames: string[]) => {
      contentBlocks.push({ type: 'steps', id: 'steps' })
      for (const name of stepNames) {
        steps.push({ id: `step-${steps.length + 1}`, name, status: 'pending' })
      }
      for (let i = 0; i < steps.length; i++) {
        steps[i].status = 'in-progress'
        updateMessage({ steps: [...steps], contentBlocks: [...contentBlocks] })
        await delay(600)
        steps[i].status = 'done'
        updateMessage({ steps: [...steps], contentBlocks: [...contentBlocks] })
        await delay(150)
      }
    }

    // Helper to simulate a tool call
    const simulateToolCall = async (name: string, args: object, result: object) => {
      if (!contentBlocks.some(b => b.type === 'tools')) {
        contentBlocks.push({ type: 'tools', id: 'tools' })
      }
      const toolCall: ToolCall = {
        id: `tool-${toolCalls.length + 1}`,
        name,
        args: '',
        isLoading: true,
      }
      toolCalls.push(toolCall)
      updateMessage({ toolCalls: [...toolCalls], contentBlocks: [...contentBlocks] })
      await delay(300)

      // Stream args
      const argsText = JSON.stringify(args)
      for (const char of argsText) {
        toolCall.args += char
        updateMessage({ toolCalls: [...toolCalls], contentBlocks: [...contentBlocks] })
        await delay(15)
      }
      await delay(400)

      // Set result
      toolCall.isLoading = false
      toolCall.result = JSON.stringify(result, null, 2)
      updateMessage({ toolCalls: [...toolCalls], contentBlocks: [...contentBlocks] })
      await delay(200)
    }

    // Parse input as space-separated commands: step, tool, text
    const commands = userContent.toLowerCase().trim().split(/\s+/)
    const validCommands = ['step', 'tool', 'text']
    const hasValidCommands = commands.some(cmd => validCommands.includes(cmd))

    if (hasValidCommands) {
      let toolIndex = 0
      let textIndex = 0
      const toolVariants = [
        { name: 'get_cluster_metrics', args: { cluster: 'prod-east' }, result: { cpu: '45%', memory: '62%' } },
        { name: 'get_pod_status', args: { namespace: 'default' }, result: { running: 12, pending: 0 } },
        { name: 'get_alerts', args: { severity: 'critical' }, result: { count: 0, alerts: [] } },
      ]
      const textVariants = [
        'Here is some information based on the analysis.',
        'The cluster is operating normally with healthy resource usage.',
        'All systems are functioning as expected.',
      ]

      for (const cmd of commands) {
        if (cmd === 'step') {
          await simulateSteps(['Analyzing query', 'Gathering context', 'Generating response'])
        } else if (cmd === 'tool') {
          const variant = toolVariants[toolIndex % toolVariants.length]
          await simulateToolCall(variant.name, variant.args, variant.result)
          toolIndex++
        } else if (cmd === 'text') {
          const text = textVariants[textIndex % textVariants.length]
          await streamText(text + '\n\n')
          textIndex++
        }
      }
    } else {
      // Default: show help
      await streamText(`You said: "${userContent}"\n\nThis is a demo. Type a space-separated sequence of:\n- **step** - show steps\n- **tool** - show tool call\n- **text** - show text\n\nExample: \`step text tool text\``)
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
