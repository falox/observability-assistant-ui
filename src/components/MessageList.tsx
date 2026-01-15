import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Message,
  MessageBox,
  ToolResponse,
  MarkdownContent,
} from '@patternfly/chatbot'
import {
  CodeBlock,
  CodeBlockCode,
  Spinner,
  ProgressStepper,
  ProgressStep,
  Alert,
  AlertVariant,
} from '@patternfly/react-core'
import {
  CheckCircleIcon,
  OutlinedCircleIcon,
} from '@patternfly/react-icons'
import type { ChatMessage, Step, ToolCall, ContentBlock } from '../types/agui'
import { TimeSeriesChart, PrometheusToolResult } from './TimeSeriesChart'

// Standard PatternFly chatbot avatars
import userAvatar from '../assets/user_avatar.svg'
import patternflyAvatar from '../assets/patternfly_avatar.jpg'

// Placeholder pattern for chart references: <<{"type": "promql", "tool_name": "...", "tool_call_id": "..."}>>
const PLACEHOLDER_REGEX = /<<(\{[^>]+\})>>/g

interface ChartPlaceholder {
  type: string
  tool_name: string
  tool_call_id: string
}

// Parse placeholder JSON from text
function parsePlaceholder(json: string): ChartPlaceholder | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed.type && parsed.tool_call_id) {
      return parsed as ChartPlaceholder
    }
  } catch {
    // Invalid JSON, ignore
  }
  return null
}

// Parse tool result JSON to extract Prometheus data
function parseToolResult(result: string): PrometheusToolResult | null {
  try {
    const parsed = JSON.parse(result)
    // Check if it has the expected structure
    if (parsed.data && parsed.data.resultType === 'matrix') {
      return parsed as PrometheusToolResult
    }
  } catch {
    // Invalid JSON or not Prometheus data
  }
  return null
}

// Component to render text with embedded charts
function TextWithCharts({
  content,
  toolCalls,
}: {
  content: string
  toolCalls: ToolCall[]
}) {
  // Build a map of tool call IDs to their results
  const toolCallMap = useMemo(() => {
    const map = new Map<string, ToolCall>()
    for (const tc of toolCalls) {
      map.set(tc.id, tc)
    }
    return map
  }, [toolCalls])

  // Split content by placeholders and render
  const parts = useMemo(() => {
    const result: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    // Reset regex state
    PLACEHOLDER_REGEX.lastIndex = 0

    while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
      // Add text before the placeholder
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index)
        if (textBefore.trim()) {
          result.push(
            <MarkdownContent key={`text-${lastIndex}`} content={textBefore} />
          )
        }
      }

      // Parse and render the placeholder
      const placeholder = parsePlaceholder(match[1])
      if (placeholder && placeholder.type === 'promql') {
        const toolCall = toolCallMap.get(placeholder.tool_call_id)
        console.log('[Chart] Looking for tool call:', placeholder.tool_call_id, 'Found:', toolCall ? { id: toolCall.id, name: toolCall.name, hasResult: !!toolCall.result, hasArgs: !!toolCall.args, resultLength: toolCall.result?.length, argsLength: toolCall.args?.length } : 'not found')

        // Try to get chart data from either result or args
        let chartData: PrometheusToolResult | null = null
        if (toolCall?.result) {
          chartData = parseToolResult(toolCall.result)
        }
        // Fallback: some tools receive data as args instead of producing it as result
        if (!chartData && toolCall?.args) {
          chartData = parseToolResult(toolCall.args)
        }

        if (chartData) {
          result.push(
            <TimeSeriesChart key={`chart-${placeholder.tool_call_id}`} data={chartData} />
          )
        } else if (toolCall?.result || toolCall?.args) {
          // Tool has data but it's not valid Prometheus matrix format
          console.warn('[Chart] Tool data is not valid Prometheus matrix data:', placeholder.tool_call_id)
        } else if (toolCall) {
          // Tool call exists but result not yet available - show loading
          result.push(
            <div key={`chart-loading-${placeholder.tool_call_id}`} style={{ padding: '1rem', textAlign: 'center' }}>
              <Spinner size="lg" aria-label="Loading chart data" />
              <div style={{ marginTop: '0.5rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
                Loading chart...
              </div>
            </div>
          )
        }
        // If tool call not found at all, silently skip (might be in a different message)
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text after last placeholder
    if (lastIndex < content.length) {
      const textAfter = content.slice(lastIndex)
      if (textAfter.trim()) {
        result.push(
          <MarkdownContent key={`text-${lastIndex}`} content={textAfter} />
        )
      }
    }

    return result
  }, [content, toolCallMap])

  // If no placeholders found, render as regular markdown
  if (parts.length === 0 && content.trim()) {
    return <MarkdownContent content={content} />
  }

  return <>{parts}</>
}

// Component for steps display
function StepsList({ steps }: { steps: Step[] }) {
  return (
    <ProgressStepper isVertical>
      {steps.map((step) => {
        const isDone = step.status === 'done'
        return (
          <ProgressStep
            key={step.id}
            variant={isDone ? 'success' : 'pending'}
            icon={isDone ? <CheckCircleIcon /> : <OutlinedCircleIcon />}
            aria-label={`${step.name}: ${step.status}`}
          >
            {step.name}
          </ProgressStep>
        )
      })}
    </ProgressStepper>
  )
}

// Style for code blocks inside tool responses to prevent overflow
const toolCodeBlockStyle: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: '200px',
  overflow: 'auto',
}

// Individual tool call item with controlled expanded state (collapsed by default)
function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const onToggle = (_event: React.MouseEvent, expanded: boolean) => {
    setIsExpanded(expanded)
  }

  return (
    <ToolResponse
      toggleContent={
        <span>
          {toolCall.isLoading && <Spinner size="sm" />} {toolCall.name}
        </span>
      }
      body={toolCall.result ? 'Tool execution completed.' : undefined}
      cardTitle={toolCall.name}
      cardBody={
        <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
          {toolCall.args && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Parameters</strong>
              <div className="tool-code-block-scroll" style={toolCodeBlockStyle}>
                <CodeBlock>
                  <CodeBlockCode>{toolCall.args}</CodeBlockCode>
                </CodeBlock>
              </div>
            </div>
          )}
          {toolCall.result && (
            <div>
              <strong>Response</strong>
              <div className="tool-code-block-scroll" style={toolCodeBlockStyle}>
                <CodeBlock>
                  <CodeBlockCode>{toolCall.result}</CodeBlockCode>
                </CodeBlock>
              </div>
            </div>
          )}
        </div>
      }
      expandableSectionProps={{
        isExpanded,
        onToggle,
      }}
    />
  )
}

// Component for tool calls
function ToolCallsList({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div style={{ marginTop: '1rem', maxWidth: '100%', overflow: 'hidden' }}>
      {toolCalls.map((toolCall) => (
        <ToolCallItem key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  )
}

// Render all content blocks in order (text, steps, tools)
function ContentBlockRenderer({
  blocks,
  steps,
  toolCalls,
}: {
  blocks: ContentBlock[]
  steps: Step[]
  toolCalls: ToolCall[]
}) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case 'text':
            return block.content ? (
              <TextWithCharts key={block.id} content={block.content} toolCalls={toolCalls} />
            ) : null
          case 'steps':
            return steps.length > 0 ? <StepsList key={block.id} steps={steps} /> : null
          case 'tools':
            return toolCalls.length > 0 ? <ToolCallsList key={block.id} toolCalls={toolCalls} /> : null
          default:
            return null
        }
      })}
    </>
  )
}


interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  runActive: boolean
}

export function MessageList({ messages, isStreaming, runActive }: MessageListProps) {
  const scrollToBottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change or loading indicator appears
  useEffect(() => {
    scrollToBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, runActive])

  return (
    <MessageBox>
      {messages.map((message) => {
        // Don't render empty streaming assistant messages - show LoadingMessage instead
        const isEmptyStreamingAssistant =
          message.role === 'assistant' &&
          message.isStreaming &&
          !message.content &&
          (!message.toolCalls || message.toolCalls.length === 0) &&
          (!message.steps || message.steps.length === 0)

        if (isEmptyStreamingAssistant) {
          return null
        }

        // Render error messages with Alert
        if (message.error) {
          return (
            <Message
              key={message.id}
              role="bot"
              name="Assistant"
              avatar={patternflyAvatar}
              extraContent={{
                beforeMainContent: (
                  <Alert
                    variant={AlertVariant.danger}
                    title={message.error.title}
                    isInline
                  >
                    {message.error.body}
                  </Alert>
                ),
              }}
            />
          )
        }

        const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0

        // When we have content blocks, render ALL content (including text) via beforeMainContent
        // to preserve the correct ordering. Don't use the content prop in this case.
        if (hasContentBlocks) {
          return (
            <Message
              key={message.id}
              role={message.role === 'user' ? 'user' : 'bot'}
              name={message.role === 'user' ? 'You' : 'Assistant'}
              avatar={message.role === 'user' ? userAvatar : patternflyAvatar}
              avatarProps={message.role === 'user' ? { isBordered: true } : undefined}
              extraContent={{
                beforeMainContent: (
                  <ContentBlockRenderer
                    blocks={message.contentBlocks!}
                    steps={message.steps || []}
                    toolCalls={message.toolCalls || []}
                  />
                ),
              }}
            />
          )
        }

        // Fallback for messages without contentBlocks (user messages, old format)
        return (
          <Message
            key={message.id}
            role={message.role === 'user' ? 'user' : 'bot'}
            name={message.role === 'user' ? 'You' : 'Assistant'}
            avatar={message.role === 'user' ? userAvatar : patternflyAvatar}
            avatarProps={message.role === 'user' ? { isBordered: true } : undefined}
            content={message.content || undefined}
            extraContent={{
              afterMainContent: (
                <>
                  {message.steps && message.steps.length > 0 && (
                    <StepsList steps={message.steps} />
                  )}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <ToolCallsList toolCalls={message.toolCalls} />
                  )}
                </>
              ),
            }}
          />
        )
      })}

      {/* Show loading indicator when run is active */}
      {runActive && (
        <Message
          role="bot"
          name="Assistant"
          avatar={patternflyAvatar}
          isLoading
        />
      )}
      {/* Auto-scroll anchor */}
      <div ref={scrollToBottomRef} />
    </MessageBox>
  )
}
