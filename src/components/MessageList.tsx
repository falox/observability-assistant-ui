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

// Simple avatar URLs (you can replace with actual avatars)
const USER_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2YTZlNzMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+'
const BOT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlZTAwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIxMSIgd2lkdGg9IjE4IiBoZWlnaHQ9IjEwIiByeD0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjEyIiBjeT0iNSIgcj0iMiI+PC9jaXJjbGU+PGxpbmUgeDE9IjEyIiB5MT0iNyIgeDI9IjEyIiB5Mj0iMTEiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE2IiB4Mj0iOCIgeTI9IjE2Ij48L2xpbmU+PGxpbmUgeDE9IjE2IiB5MT0iMTYiIHgyPSIxNiIgeTI9IjE2Ij48L2xpbmU+PC9zdmc+'

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
          avatar={message.role === 'user' ? USER_AVATAR : BOT_AVATAR}
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
