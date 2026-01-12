import { useState } from 'react'
import {
  Chatbot,
  ChatbotDisplayMode,
  ChatbotContent,
  ChatbotHeader,
  ChatbotHeaderMain,
  ChatbotHeaderTitle,
  ChatbotHeaderActions,
  ChatbotFooter,
  ChatbotFootnote,
  MessageBar,
} from '@patternfly/chatbot'
import { Button } from '@patternfly/react-core'
import { TimesIcon } from '@patternfly/react-icons'
import { MessageList } from './MessageList'
import type { ChatMessage } from '../types/agui'

interface ChatWindowProps {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  onSendMessage: (content: string) => void
  onClearMessages: () => void
}

export function ChatWindow({
  messages,
  isStreaming,
  error,
  onSendMessage,
  onClearMessages,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('')

  const handleSend = (message: string | number) => {
    const text = String(message).trim()
    if (text && !isStreaming) {
      onSendMessage(text)
      setInputValue('')
    }
  }

  const handleChange = (_event: React.ChangeEvent<HTMLTextAreaElement>, value: string | number) => {
    setInputValue(String(value))
  }

  return (
    <Chatbot displayMode={ChatbotDisplayMode.fullscreen}>
      <ChatbotHeader>
        <ChatbotHeaderMain>
          <ChatbotHeaderTitle>
            Observability Assistant
          </ChatbotHeaderTitle>
        </ChatbotHeaderMain>
        <ChatbotHeaderActions>
          <Button
            variant="plain"
            aria-label="Clear chat"
            onClick={onClearMessages}
            isDisabled={messages.length === 0}
          >
            <TimesIcon />
          </Button>
        </ChatbotHeaderActions>
      </ChatbotHeader>

      <ChatbotContent>
        <MessageList messages={messages} isStreaming={isStreaming} />
      </ChatbotContent>

      <ChatbotFooter>
        {error && (
          <div style={{ color: 'var(--pf-t--global--color--status--danger--default)', padding: '0.5rem' }}>
            Error: {error}
          </div>
        )}
        <MessageBar
          onSendMessage={handleSend}
          onChange={handleChange}
          value={inputValue}
          hasStopButton={isStreaming}
          isSendButtonDisabled={isStreaming || !inputValue.trim()}
          placeholder="Ask about your cluster..."
        />
        <ChatbotFootnote
          label="This is an AI assistant. Responses may not always be accurate."
        />
      </ChatbotFooter>
    </Chatbot>
  )
}
