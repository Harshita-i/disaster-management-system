import { useState } from 'react';
import api from '../utils/api';

export default function SafetyChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hi, I am your safety assistant.\nAsk me anything about disaster safety and emergency preparedness.',
    },
  ]);
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg = { from: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/chat/safety', { message: trimmed });
      const answer = res.data?.answer || 'Sorry, I could not generate an answer.';
      const botMsg = { from: 'bot', text: answer };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: 'Sorry, something went wrong. Please try again.' },
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
        type="button"
        className="chat-fab"
        onClick={() => setOpen(true)}
        aria-label="Open safety assistant"
      >
        🛡️
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div>
          <div className="chat-panel-title">Safety Assistant</div>
          <div className="chat-panel-sub">Disaster safety & preparedness</div>
        </div>
        <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble-row ${m.from}`}>
            <div className={`chat-bubble ${m.from}`}>{m.text}</div>
          </div>
        ))}
        {sending && <div className="chat-typing">Typing…</div>}
      </div>

      <div className="chat-input-area">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. What should I do during an earthquake?"
        />
        <button type="button" className="chat-send" onClick={sendMessage} disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
