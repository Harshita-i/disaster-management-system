// filepath: /Users/shalinikotha/Desktop/MyProjects/mini_project/disaster-management-system/frontend/src/components/SafetyChatbot.jsx
import { useState } from 'react';
import api from '../utils/api';

export default function SafetyChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hi, I am your safety assistant.\nAsk me anything about disaster safety and emergency preparedness.'
    }
  ]);
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg = { from: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/chat/safety', { message: trimmed });
      const answer = res.data?.answer || 'Sorry, I could not generate an answer.';
      const botMsg = { from: 'bot', text: answer };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: '#2563eb',
          color: 'white',
          fontSize: 26,
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          zIndex: 1000
        }}
      >
        ?
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        width: 320,
        maxHeight: 420,
        background: '#020617',
        borderRadius: 16,
        border: '1px solid #1f2937',
        boxShadow: '0 15px 35px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1000,
        fontFamily: 'sans-serif'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          background: '#1f2937',
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
            🛡️ Safety Assistant
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            Powered by Gemini (safety questions only)
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '10px 10px 4px',
          overflowY: 'auto',
          fontSize: 12
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 8,
              display: 'flex',
              justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
                padding: '6px 9px',
                borderRadius: 10,
                background: m.from === 'user' ? '#2563eb' : '#111827',
                color: '#e5e7eb',
                border: m.from === 'user' ? 'none' : '1px solid #1f2937',
                fontSize: 12,
                lineHeight: 1.4
              }}
            >
              {m.text}
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
            Typing…
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: 8,
          borderTop: '1px solid #1f2937',
          background: '#020617'
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: What should I do during an earthquake?"
          style={{
            width: '100%',
            resize: 'none',
            background: '#020617',
            borderRadius: 8,
            border: '1px solid #374151',
            color: '#e5e7eb',
            fontSize: 12,
            padding: '6px 8px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending}
          style={{
            marginTop: 6,
            width: '100%',
            padding: '6px 0',
            borderRadius: 8,
            border: 'none',
            background: sending ? '#4b5563' : '#16a34a',
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
            cursor: sending ? 'default' : 'pointer'
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}