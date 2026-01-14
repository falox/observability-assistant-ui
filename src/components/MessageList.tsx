import { useEffect, useRef, useState } from 'react'
import {
  Message,
  MessageBox,
  ToolResponse,
} from '@patternfly/chatbot'
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockAction,
  Button,
  Tooltip,
  Spinner,
  ProgressStepper,
  ProgressStep,
  Content,
  ContentVariants,
  List,
  ListItem,
  ListComponent,
  getUniqueId,
  Alert,
  AlertVariant,
} from '@patternfly/react-core'
import {
  CheckCircleIcon,
  OutlinedCircleIcon,
  CopyIcon,
  CheckIcon,
} from '@patternfly/react-icons'
import ReactMarkdown, { Components } from 'react-markdown'
import type { ChatMessage, Step, ToolCall, ContentBlock } from '../types/agui'

// Standard PatternFly chatbot avatars
import userAvatar from '../assets/user_avatar.svg'
import patternflyAvatar from '../assets/patternfly_avatar.jpg'

// Code block component with copy button for markdown rendering
function CodeBlockWithCopy({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipId = getUniqueId()

  const language = /language-(\w+)/.exec(className || '')?.[1]
  const codeString = String(children).replace(/\n$/, '')

  // For inline code (no newlines), render as simple code element
  if (!String(children).includes('\n')) {
    return <code className="pf-chatbot__message-inline-code">{children}</code>
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const actions = (
    <CodeBlockAction>
      {language && <div className="pf-chatbot__message-code-block-language">{language}</div>}
      <Button
        ref={buttonRef}
        aria-label="Copy code"
        variant="plain"
        className="pf-chatbot__button--copy"
        onClick={handleCopy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <Tooltip id={tooltipId} content="Copy" position="top" triggerRef={buttonRef} />
    </CodeBlockAction>
  )

  return (
    <div className="pf-chatbot__message-code-block">
      <CodeBlock actions={actions}>
        <CodeBlockCode>{codeString}</CodeBlockCode>
      </CodeBlock>
    </div>
  )
}

// Custom components for ReactMarkdown to use PatternFly styling
const markdownComponents: Components = {
  p: ({ children }) => (
    <span className="pf-chatbot__message-text">
      <Content component={ContentVariants.p}>{children}</Content>
    </span>
  ),
  code: ({ children, className }) => (
    <CodeBlockWithCopy className={className}>{children}</CodeBlockWithCopy>
  ),
  ul: ({ children }) => (
    <div className="pf-chatbot__message-unordered-list">
      <List>{children}</List>
    </div>
  ),
  ol: ({ children }) => (
    <div className="pf-chatbot__message-ordered-list">
      <List component={ListComponent.ol}>{children}</List>
    </div>
  ),
  li: ({ children }) => <ListItem>{children}</ListItem>,
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
              <ReactMarkdown key={block.id} components={markdownComponents}>
                {block.content}
              </ReactMarkdown>
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
