import { useState, useEffect } from 'react'
import {
  Chatbot,
  ChatbotDisplayMode,
  ChatbotContent,
  ChatbotHeader,
  ChatbotHeaderMain,
  ChatbotHeaderTitle,
  ChatbotHeaderActions,
  ChatbotHeaderOptionsDropdown,
  ChatbotFooter,
  ChatbotFootnote,
  MessageBar,
} from '@patternfly/chatbot'
import { DropdownList, DropdownItem, DropdownGroup, Divider } from '@patternfly/react-core'
import { TimesIcon, SunIcon, MoonIcon, AdjustIcon } from '@patternfly/react-icons'
import { MessageList } from './MessageList'
import type { ChatMessage } from '../types/agui'

interface ChatWindowProps {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  onSendMessage: (content: string) => void
  onClearMessages: () => void
}

type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'theme-preference'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function ChatWindow({
  messages,
  isStreaming,
  error,
  onSendMessage,
  onClearMessages,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('')
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  // Apply theme to document
  useEffect(() => {
    const applyTheme = (selectedTheme: Theme) => {
      const isDark =
        selectedTheme === 'dark' ||
        (selectedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

      if (isDark) {
        document.documentElement.classList.add('pf-v6-theme-dark')
      } else {
        document.documentElement.classList.remove('pf-v6-theme-dark')
      }
    }

    applyTheme(theme)

    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const onSelectTheme = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      setTheme(value)
      localStorage.setItem(THEME_STORAGE_KEY, value)
    }
  }

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
          <ChatbotHeaderOptionsDropdown onSelect={onSelectTheme}>
            <DropdownGroup label="Theme">
              <DropdownList>
                <DropdownItem
                  value="light"
                  key="theme-light"
                  icon={<SunIcon aria-hidden />}
                  isSelected={theme === 'light'}
                >
                  Light
                </DropdownItem>
                <DropdownItem
                  value="dark"
                  key="theme-dark"
                  icon={<MoonIcon aria-hidden />}
                  isSelected={theme === 'dark'}
                >
                  Dark
                </DropdownItem>
                <DropdownItem
                  value="system"
                  key="theme-system"
                  icon={<AdjustIcon aria-hidden />}
                  isSelected={theme === 'system'}
                >
                  System
                </DropdownItem>
              </DropdownList>
            </DropdownGroup>
            <Divider />
            <DropdownList>
              <DropdownItem
                value="clear"
                key="clear-chat"
                icon={<TimesIcon aria-hidden />}
                isDisabled={messages.length === 0}
                onClick={onClearMessages}
              >
                Clear chat
              </DropdownItem>
            </DropdownList>
          </ChatbotHeaderOptionsDropdown>
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
          label="Observability Assistant uses AI. Check for mistakes."
          popover={{
            title: 'Verify information',
            description:
              'While this assistant strives for accuracy, AI is experimental and can make mistakes. We cannot guarantee that all information provided is up to date or without error. You should always verify responses using reliable sources, especially for crucial information and decision making.',
            cta: {
              label: 'Dismiss',
              onClick: () => {},
            },
            link: {
              label: 'Learn more about AI',
              url: 'https://www.redhat.com/en/topics/ai',
            },
          }}
        />
      </ChatbotFooter>
    </Chatbot>
  )
}
