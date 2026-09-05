import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ToastProvider';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getApiUrl, estApplicationNative } from '../utils/apiConfig';
import {
  consulterLocal,
  lireConversationLocale,
  ecrireConversationLocale,
  viderConversationLocale,
} from '../moteur/repetiteurLocal';

import logger from '../utils/logger';
import ConfirmModal from './ConfirmModal';
/**
 * Le Répétiteur.
 *
 * Le nom n'est pas un habillage : dans l'enseignement superieur français, un
 * répétiteur est celui qui fait réciter la leçon et constate ce qui est
 * réellement su. C'est exactement la fonction ici — rendre compte de l'état des
 * révisions, sans rien y ajouter. « Coach IA » promettait autre chose : un
 * interlocuteur qui conseille, encourage, improvise. Celui-ci ne fait rien de
 * tel, et il vaut mieux que son nom le dise.
 */

/**
 * Adresse du répétiteur.
 *
 * Une adresse relative suffit tant que l'application est servie par le bridge.
 * Empaquetée dans l'application Android, elle est servie depuis
 * `http://localhost` par la WebView : `/api/chat` y désigne le téléphone
 * lui-même, où rien n'écoute. Le panneau s'ouvrait donc bien sur le téléphone,
 * mais toute question s'y terminait par « le serveur est-il lancé ? ». Tout le
 * reste de l'application passait déjà par `getApiUrl()` ; ce panneau était le
 * seul oubli.
 */
const urlChat = () => `${getApiUrl()}/chat`;

/*
 * Sur le téléphone, le Répétiteur ne sort plus de l'appareil.
 *
 * Le moteur y est embarqué depuis le projet de synchronisation : le programme
 * du jour s'y calcule sans le PC. Le Répétiteur, lui, restait au bout d'un
 * câble — il lit pourtant exactement les mêmes tables. PC éteint, chaque
 * question se terminait par « le serveur est-il lancé ? » sur un appareil qui
 * avait toutes les réponses en main.
 *
 * Le chemin réseau reste celui du PC, où la conversation est un fichier partagé
 * et où le bridge sert l'interface.
 */
const enLocal = () => estApplicationNative();

export default function Repetiteur() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { toast } = useToast();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const fetchHistory = async () => {
    if (enLocal()) {
      setMessages(lireConversationLocale());
      return;
    }
    try {
      const res = await fetchWithRetry(urlChat());
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      logger.error('Failed to fetch chat history', err);
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

    if (enLocal()) {
      // Le calcul est synchrone : le court délai n'est là que pour que la
      // réponse ne surgisse pas avant que l'oeil n'ait suivi la question.
      const reponse = consulterLocal(newMsg.content);
      const suite = [...updatedMessages, { role: 'assistant', content: reponse.content }];
      setMessages(suite);
      ecrireConversationLocale(suite);
      setIsTyping(false);
      return;
    }

    try {
      const res = await fetchWithRetry(urlChat(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erreur API');

      setMessages([...updatedMessages, { role: 'assistant', content: data.content }]);
    } catch (err) {
      toast.error('Le Répétiteur n’a pas répondu. Le serveur est-il lancé ?');
      logger.error(err);
      // Remove user message if failed
      setMessages(messages);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = () => {
    setClearConfirmOpen(true);
  };

  const handleConfirmClear = async () => {
    if (enLocal()) {
      viderConversationLocale();
      setMessages([]);
      setClearConfirmOpen(false);
      toast.success('Historique effacé.');
      return;
    }
    try {
      await fetchWithRetry(urlChat(), { method: 'DELETE' });
      setMessages([]);
      setClearConfirmOpen(false);
      toast.success('Historique effacé.');
    } catch (err) {
      setClearConfirmOpen(false);
      toast.error('Impossible d\'effacer l\'historique.');
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {/* Les styles en ligne ne connaissent pas la largeur de l'écran : la pile
          de boutons flottants vit désormais dans `primitives.css`, où elle peut
          s'adapter au téléphone. */}
      <button
        type="button"
        className="el-flottant el-flottant--coach"
        onClick={() => setIsOpen(true)}
        style={{ display: isOpen ? 'none' : 'flex' }}
        title="Ouvrir le Répétiteur"
        aria-label="Ouvrir le Répétiteur"
      >
        <span aria-hidden="true">🤖</span>
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
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Le Répétiteur</h3>
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
                    Interroge-moi sur ton programme, tes notes, ton avancement, le règlement.
                    Je ne consulte que tes données, et je ne réponds que ce qu’elles disent —
                    quand je ne sais pas, je le dis.
                  </p>
                )}
                {messages.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? 'var(--accent-fort)' : 'var(--bg-tertiary)',
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
                    Consultation de tes données…
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
                  placeholder="Pose ta question…"
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
                    background: input.trim() && !isTyping ? 'var(--accent-fort)' : 'var(--bg-tertiary)',
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
      <ConfirmModal
        isOpen={clearConfirmOpen}
        onConfirm={handleConfirmClear}
        onCancel={() => setClearConfirmOpen(false)}
        title="Vider l'historique"
        message="Effacer toute la conversation ? Tes révisions ne sont pas concernées."
        confirmLabel="Effacer"
        cancelLabel="Annuler"
        danger
      />
    </>
  );
}
