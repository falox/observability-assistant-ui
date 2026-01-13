import { useEffect, useRef } from 'react'
import {
  Message,
  MessageBox,
  ToolResponse,
} from '@patternfly/chatbot'
import {
  ExpandableSection,
  Label,
  LabelGroup,
  CodeBlock,
  CodeBlockCode,
  Spinner,
} from '@patternfly/react-core'
import {
  CheckCircleIcon,
  InProgressIcon,
  WrenchIcon,
} from '@patternfly/react-icons'
import type { ChatMessage } from '../types/agui'

// Standard PatternFly chatbot avatars
import userAvatar from '../assets/user_avatar.svg'
import patternflyAvatar from '../assets/patternfly_avatar.jpg'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
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
                {/* Steps / Thinking */}
                {message.steps && message.steps.length > 0 && (
                  <ExpandableSection
                    toggleText={`${message.steps.filter(s => s.isComplete).length}/${message.steps.length} steps completed`}
                    isIndented
                  >
                    <LabelGroup>
                      {message.steps.map((step) => (
                        <Label
                          key={step.id}
                          color={step.isComplete ? 'green' : 'blue'}
                          icon={step.isComplete ? <CheckCircleIcon /> : <InProgressIcon />}
                        >
                          {step.name}
                        </Label>
                      ))}
                    </LabelGroup>
                  </ExpandableSection>
                )}

                {/* Tool Calls */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    {message.toolCalls.map((toolCall) => (
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
                )}
              </>
            ),
          }}
        />
        )
      })}

      {/* Show loading indicator when streaming and no visible assistant content yet */}
      {isStreaming && (() => {
        const lastMessage = messages[messages.length - 1]
        // Show loading if last message is user, or if last message is empty streaming assistant
        const showLoading =
          lastMessage?.role === 'user' ||
          (lastMessage?.role === 'assistant' &&
            lastMessage.isStreaming &&
            !lastMessage.content &&
            (!lastMessage.toolCalls || lastMessage.toolCalls.length === 0) &&
            (!lastMessage.steps || lastMessage.steps.length === 0))
        return showLoading ? (
          <Message
            role="bot"
            name="Assistant"
            avatar={patternflyAvatar}
            isLoading
          />
        ) : null
      })()}
      {/* Auto-scroll anchor */}
      <div ref={scrollToBottomRef} />
    </MessageBox>
  )
}
