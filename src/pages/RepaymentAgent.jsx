import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Loader2, Plus, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  if (message.role === 'system') return null;
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={14} className="text-primary" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border border-border text-foreground'
      }`}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:font-semibold">
            {message.content || '…'}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function RepaymentAgent() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const bottomRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    base44.agents.listConversations({ agent_name: 'repayment_tracker' })
      .then(convs => {
        setConversations(convs || []);
        setLoadingConvs(false);
      })
      .catch(() => setLoadingConvs(false));
  }, []);

  // Subscribe to active conversation
  useEffect(() => {
    if (!activeConv) return;
    const unsub = base44.agents.subscribeToConversation(activeConv.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [activeConv?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: 'repayment_tracker',
      metadata: { name: `Chat — ${format(new Date(), 'dd MMM yyyy, h:mm a')}` },
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
  };

  const openConversation = async (conv) => {
    setActiveConv(conv);
    const full = await base44.agents.getConversation(conv.id);
    setMessages(full.messages || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    let conv = activeConv;
    if (!conv) {
      conv = await base44.agents.createConversation({
        agent_name: 'repayment_tracker',
        metadata: { name: `Chat — ${format(new Date(), 'dd MMM yyyy, h:mm a')}` },
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConv(conv);
    }
    const text = input.trim();
    setInput('');
    setSending(true);
    await base44.agents.addMessage(conv, { role: 'user', content: text });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-card shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Bot size={16} className="text-primary" />
            <span className="font-syne font-bold text-sm">Repayment Tracker</span>
          </div>
          <Button size="sm" className="w-full gap-2" onClick={startNewConversation}>
            <Plus size={14} /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConvs ? (
            <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No chats yet</p>
          ) : conversations.map(conv => (
            <button key={conv.id} onClick={() => openConversation(conv)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                activeConv?.id === conv.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}>
              <div className="flex items-center gap-1.5">
                <MessageSquare size={11} />
                <span className="truncate">{conv.metadata?.name || 'Chat'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot size={30} className="text-primary" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-lg">Repayment Tracker</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Ask about loan statuses, outstanding amounts, overdue cases, or payment history for any borrower.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {[
                'Show all overdue loans',
                'What is outstanding for Ravi Kumar?',
                'List loans closed this month',
                'Which loans have partial collections?',
              ].map(q => (
                <button key={q} onClick={() => { setInput(q); }}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  {q}
                </button>
              ))}
            </div>
            <Button className="gap-2" onClick={startNewConversation}>
              <Plus size={14} /> Start a Chat
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {visibleMessages.length === 0 && (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  Ask anything about loan repayments and statuses…
                </div>
              )}
              {visibleMessages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {sending && (
                <div className="flex gap-2 justify-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about a loan, borrower, or overdue cases…"
                  className="flex-1"
                  disabled={sending}
                />
                <Button size="icon" onClick={sendMessage} disabled={!input.trim() || sending}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}