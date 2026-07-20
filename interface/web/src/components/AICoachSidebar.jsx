import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ToastProvider';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export default function AICoachSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      const res = await fetchWithRetry('/api/chat');
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch chat history', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMsg = { role: 'user', content: input };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erreur API');

      setMessages([...updatedMessages, { role: 'assistant', content: data.content }]);
    } catch (err) {
      toast.error('Erreur de communication avec le coach IA.');
      console.error(err);
      // Remove user message if failed
      setMessages(messages);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Voulez-vous vraiment effacer tout l\'historique du coach ?')) return;
    try {
      await fetchWithRetry('/api/chat', { method: 'DELETE' });
      setMessages([]);
      toast.success('Historique effacé.');
    } catch (err) {
      toast.error('Impossible d\'effacer l\'historique.');
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: 9999,
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
        title="Ouvrir le Coach IA"
      >
        🤖
      </button>

      {/* Overlay & Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(2px)',
                zIndex: 9999,
              }}
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed',
                top: 0, right: 0, bottom: 0,
                width: '100%',
                maxWidth: '400px',
                background: 'var(--bg-secondary)',
                borderLeft: '1px solid var(--glass-border)',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid var(--bg-tertiary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-primary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🤖</span>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Coach ELPIS</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleClear} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Vider l'historique">🗑️</button>
                  <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
                </div>
              </div>

              {/* Chat Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                    Aucun message. Posez une question au Coach !
                  </p>
                )}
                {messages.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    padding: '0.8rem 1.2rem',
                    borderRadius: '16px',
                    borderBottomRightRadius: msg.role === 'user' ? 0 : '16px',
                    borderBottomLeftRadius: msg.role === 'assistant' ? 0 : '16px',
                    maxWidth: '85%',
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                ))}
                {isTyping && (
                  <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                    Le coach réfléchit...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div style={{
                padding: '1rem',
                borderTop: '1px solid var(--bg-tertiary)',
                background: 'var(--bg-primary)',
                display: 'flex',
                gap: '0.5rem'
              }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Posez votre question..."
                  disabled={isTyping}
                  style={{
                    flex: 1,
                    padding: '0.8rem 1rem',
                    borderRadius: '24px',
                    border: '1px solid var(--bg-tertiary)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isTyping || !input.trim()}
                  style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    background: input.trim() && !isTyping ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: '#fff',
                    border: 'none',
                    cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}
                >
                  ➤
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
