import {
  Message,
  MessageBox,
  LoadingMessage,
} from '@patternfly/chatbot'
import {
  ExpandableSection,
  Label,
  LabelGroup,
  CodeBlock,
  CodeBlockCode,
} from '@patternfly/react-core'
import {
  CheckCircleIcon,
  InProgressIcon,
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
  return (
    <MessageBox>
      {messages.map((message) => (
        <Message
          key={message.id}
          role={message.role === 'user' ? 'user' : 'bot'}
          name={message.role === 'user' ? 'You' : 'Assistant'}
          avatar={message.role === 'user' ? userAvatar : patternflyAvatar}
          avatarProps={message.role === 'user' ? { isBordered: true } : undefined}
          content={message.content || undefined}
          isLoading={message.isStreaming && !message.content}
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
                      <ExpandableSection
                        key={toolCall.id}
                        toggleText={
                          toolCall.isLoading
                            ? `Running: ${toolCall.name}...`
                            : `Tool: ${toolCall.name}`
                        }
                        isIndented
                      >
                        {toolCall.args && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Arguments:</strong>
                            <CodeBlock>
                              <CodeBlockCode>{toolCall.args}</CodeBlockCode>
                            </CodeBlock>
                          </div>
                        )}
                        {toolCall.result && (
                          <div>
                            <strong>Result:</strong>
                            <CodeBlock>
                              <CodeBlockCode>{toolCall.result}</CodeBlockCode>
                            </CodeBlock>
                          </div>
                        )}
                      </ExpandableSection>
                    ))}
                  </div>
                )}
              </>
            ),
          }}
        />
      ))}

      {/* Show loading indicator when streaming but no assistant message yet */}
      {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
        <LoadingMessage />
      )}
    </MessageBox>
  )
}
