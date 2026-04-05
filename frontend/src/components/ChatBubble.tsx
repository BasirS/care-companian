import ReactMarkdown from 'react-markdown'
import { type Message } from '../context/ChatContext'

export default function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isError = message.text.startsWith('⚠️')

  return (
    <div className="fade-up" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 5,
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-light)',
        padding: '0 4px',
        letterSpacing: '0.2px',
      }}>
        {isUser ? 'You' : 'CareCompanion'}
      </span>
      <div style={{
        maxWidth: '74%',
        padding: '11px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        fontSize: 14,
        lineHeight: 1.7,
        wordBreak: 'break-word',
        ...(isUser
          ? {
              background: 'var(--navy)',
              color: '#fff',
              fontWeight: 400,
              boxShadow: '0 2px 8px rgba(10,37,64,0.18)',
              whiteSpace: 'pre-wrap',
            }
          : isError
          ? {
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              whiteSpace: 'pre-wrap',
            }
          : {
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }),
      }}>
        {isUser || isError ? (
          message.text
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p style={{ margin: '0 0 8px 0' }}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul style={{ margin: '6px 0 8px 0', paddingLeft: 20 }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ margin: '6px 0 8px 0', paddingLeft: 20 }}>{children}</ol>
              ),
              li: ({ children }) => (
                <li style={{ marginBottom: 4 }}>{children}</li>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 700, color: 'var(--navy)' }}>{children}</strong>
              ),
              em: ({ children }) => (
                <em style={{ fontStyle: 'italic' }}>{children}</em>
              ),
              h1: ({ children }) => (
                <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', margin: '4px 0 10px 0', fontFamily: 'var(--font-heading)' }}>{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', margin: '4px 0 8px 0', fontFamily: 'var(--font-heading)' }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', margin: '4px 0 6px 0' }}>{children}</h3>
              ),
              hr: () => (
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />
              ),
              code: ({ children }) => (
                <code style={{ background: 'var(--surface-2)', borderRadius: 4, padding: '1px 5px', fontSize: 13, fontFamily: 'monospace' }}>{children}</code>
              ),
            }}
          >
            {message.text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
