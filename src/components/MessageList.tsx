import { useEffect, useRef, useState } from 'react'
import {
  Message,
  MessageBox,
  ToolResponse,
} from '@patternfly/chatbot'
import {
  ExpandableSection,
  CodeBlock,
  CodeBlockCode,
  Spinner,
  ProgressStepper,
  ProgressStep,
} from '@patternfly/react-core'
import {
  CheckCircleIcon,
  OutlinedCircleIcon,
  WrenchIcon,
} from '@patternfly/react-icons'
import type { ChatMessage, Step, ToolCall, ContentBlock } from '../types/agui'

// Standard PatternFly chatbot avatars
import userAvatar from '../assets/user_avatar.svg'
import patternflyAvatar from '../assets/patternfly_avatar.jpg'

// Separate component for steps to manage expanded state
function StepsList({ steps }: { steps: Step[] }) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <ExpandableSection
      toggleText={`${steps.filter(s => s.status === 'done').length}/${steps.length} steps completed`}
      isIndented
      isExpanded={isExpanded}
      onToggle={(_event, expanded) => setIsExpanded(expanded)}
    >
      <ProgressStepper isVertical>
        {steps.map((step) => {
          const variant = step.status === 'done' ? 'success'
            : step.status === 'in-progress' ? 'info'
            : 'pending'
          const icon = step.status === 'done' ? <CheckCircleIcon />
            : step.status === 'in-progress' ? <Spinner size="md" />
            : <OutlinedCircleIcon />
          return (
            <ProgressStep
              key={step.id}
              variant={variant}
              icon={icon}
              isCurrent={step.status === 'in-progress'}
              aria-label={`${step.name}: ${step.status}`}
            >
              {step.name}
            </ProgressStep>
          )
        })}
      </ProgressStepper>
    </ExpandableSection>
  )
}

// Component for tool calls
function ToolCallsList({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      {toolCalls.map((toolCall) => (
        <ToolResponse
          key={toolCall.id}
          toggleContent={
            <span>
              {toolCall.isLoading ? (
                <>
                  <Spinner size="sm" /> Running: {toolCall.name}...
                </>
              ) : (
                <>
                  <WrenchIcon /> Tool response: {toolCall.name}
                </>
              )}
            </span>
          }
          body={toolCall.result ? 'Tool execution completed.' : undefined}
          cardTitle={
            <span>
              <WrenchIcon /> {toolCall.name}
            </span>
          }
          cardBody={
            <>
              {toolCall.args && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Parameters</strong>
                  <CodeBlock>
                    <CodeBlockCode>{toolCall.args}</CodeBlockCode>
                  </CodeBlock>
                </div>
              )}
              {toolCall.result && (
                <div>
                  <strong>Response</strong>
                  <CodeBlock>
                    <CodeBlockCode>{toolCall.result}</CodeBlockCode>
                  </CodeBlock>
                </div>
              )}
            </>
          }
        />
      ))}
    </div>
  )
}

// Render content blocks (steps/tools only, text is handled separately)
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
            // Text is rendered via the content prop, skip here
            return null
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

// Split content blocks into before and after the first text block
function splitContentBlocks(blocks: ContentBlock[]): {
  beforeText: ContentBlock[]
  afterText: ContentBlock[]
} {
  const firstTextIndex = blocks.findIndex((b) => b.type === 'text')
  if (firstTextIndex === -1) {
    // No text block, everything goes before
    return { beforeText: blocks, afterText: [] }
  }
  return {
    beforeText: blocks.slice(0, firstTextIndex),
    afterText: blocks.slice(firstTextIndex + 1), // Skip the text block itself
  }
}

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  runActive: boolean
}

export function MessageList({ messages, isStreaming, runActive }: MessageListProps) {
  const scrollToBottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

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

        // Split content blocks into before/after text for proper positioning
        const { beforeText, afterText } = message.contentBlocks && message.contentBlocks.length > 0
          ? splitContentBlocks(message.contentBlocks)
          : { beforeText: [], afterText: [] }

        const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0

        return (
          <Message
            key={message.id}
            role={message.role === 'user' ? 'user' : 'bot'}
            name={message.role === 'user' ? 'You' : 'Assistant'}
            avatar={message.role === 'user' ? userAvatar : patternflyAvatar}
            avatarProps={message.role === 'user' ? { isBordered: true } : undefined}
            content={message.content || undefined}
            extraContent={{
            beforeMainContent: hasContentBlocks && beforeText.length > 0 ? (
              <ContentBlockRenderer
                blocks={beforeText}
                steps={message.steps || []}
                toolCalls={message.toolCalls || []}
              />
            ) : undefined,
            afterMainContent: hasContentBlocks ? (
              afterText.length > 0 ? (
                <ContentBlockRenderer
                  blocks={afterText}
                  steps={message.steps || []}
                  toolCalls={message.toolCalls || []}
                />
              ) : undefined
            ) : (
              // Fallback for messages without contentBlocks (e.g., from old format)
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

      {/* Show loading indicator when run is active and no current message is streaming */}
      {runActive && !messages.some(m => m.isStreaming) && (
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
