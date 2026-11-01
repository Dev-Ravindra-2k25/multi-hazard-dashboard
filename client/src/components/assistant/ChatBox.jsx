import React, { useState, useEffect, useRef } from 'react';
import { askAssistant } from '../../api/ai.js';

const SUGGESTIONS = [
  'What does this risk level mean?',
  'Where is the nearest shelter?',
  'What should I do now?'
];

const MAX_CHARS = 300;

export function ChatBox({ region }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const regionId = region?._id;
  const regionName = region?.name || 'this region';

  // Reset chat messages when the selected region changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setLoading(false);
  }, [regionId]);

  // Auto-scroll messages list to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (questionText) => {
    const q = (typeof questionText === 'string' ? questionText : input).trim();
    if (!q || !regionId || loading) return;

    // Add user message
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Send only latest question and regionId (not chat history)
      const res = await askAssistant({
        regionId,
        question: q
      });

      if (res && res.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: res.answer
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: 'The assistant is unavailable right now'
          }
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: 'The assistant is unavailable right now'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  const charsRemaining = MAX_CHARS - input.length;

  return (
    <div className="chatbox-panel">
      <div className="chatbox-header">
        <div className="chatbox-title-wrap">
          <span className="chatbox-icon">💬</span>
          <h3 className="chatbox-title">Citizen Safety Assistant ({regionName})</h3>
        </div>
        <p className="chatbox-disclaimer">
          AI assistant. Not an official source. In an emergency call 112.
        </p>
      </div>

      {/* Suggestion Chips */}
      <div className="chatbox-chips">
        {SUGGESTIONS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            className="chip-btn"
            onClick={() => sendQuestion(chip)}
            disabled={loading}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="chatbox-messages">
        {messages.length === 0 && !loading && (
          <div className="chatbox-empty">
            <p>Ask a question about {regionName}'s current hazard risk, nearest shelters, or safety advice.</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble chat-bubble-${m.sender}`}
          >
            <div className="chat-bubble-sender">
              {m.sender === 'user' ? 'You' : 'Safety Assistant'}
            </div>
            {/* Render plain text only (never dangerouslySetInnerHTML) */}
            <div className="chat-bubble-text">{m.text}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble-assistant loading-bubble">
            <span className="chat-bubble-sender">Safety Assistant</span>
            <div className="chat-loading-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot-text">Consulting official hazard data...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chatbox-input-container">
        <div className="input-with-counter">
          <input
            type="text"
            className="chatbox-input"
            placeholder={`Ask about hazards or shelters in ${regionName}...`}
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            id="assistant-question-input"
          />
          <span
            className={`chatbox-char-counter ${charsRemaining < 30 ? 'counter-warning' : ''}`}
          >
            {input.length}/{MAX_CHARS}
          </span>
        </div>

        <button
          type="button"
          className="btn-chat-send"
          onClick={() => sendQuestion()}
          disabled={loading || !input.trim()}
          id="btn-chat-send"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default ChatBox;
