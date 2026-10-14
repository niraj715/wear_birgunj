import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User as UserIcon,
  HelpCircle,
  Ticket,
  ChevronDown,
  Sparkles,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  ticketPrompt?: boolean;
}

export const CustomerSupportChatbot: React.FC = () => {
  const { user, showToast } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaste! Welcome to Wear Birgunj Support. I can help you with tracking your Birgunj local delivery, our 36-hour Easy Exchange policy, order inquiries, or connecting you with human support.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ticket creation modal state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<'ORDER_ISSUE' | 'RETURN_EXCHANGE' | 'PAYMENT' | 'DELIVERY' | 'OTHER'>('ORDER_ISSUE');
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickPrompts = [
    'How does 36-hour Easy Exchange work?',
    'What are the 2-4 hour delivery wards in Birgunj?',
    'Track my order #ord-wb123455',
    'How do I register as a vendor?',
    'What payment methods are supported?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      const res = await apiFetch<{
        reply: string;
        orderLookup?: any;
        provider?: string;
        suggestTicket?: boolean;
      }>('/support/chat', {
        method: 'POST',
        body: { message: text },
      });

      const botMsg: Message = {
        id: `msg-${Date.now()}-bot`,
        sender: 'assistant',
        text: res.reply || 'Thank you for reaching out to Wear Birgunj Support.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ticketPrompt: res.suggestTicket,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-${Date.now()}-err`,
        sender: 'assistant',
        text: 'We are experiencing high demand right now. For urgent help, please reach our Birgunj support desk at support@wearbirgunj.np or call +977 51 520000.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ticketPrompt: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please sign in to submit a verified support ticket.', 'error');
      return;
    }
    if (ticketDescription.length < 10) {
      showToast('Description must be at least 10 characters long.', 'error');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await apiFetch<{ ticket: any }>('/support/tickets', {
        method: 'POST',
        body: {
          subject: ticketSubject,
          category: ticketCategory,
          orderId: ticketOrderId.trim() || undefined,
          description: ticketDescription,
        },
      });

      showToast(`Support Ticket ${res.ticket.case_number} created successfully!`, 'success');
      setShowTicketModal(false);
      setTicketSubject('');
      setTicketOrderId('');
      setTicketDescription('');

      // Add notification to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `ticket-${Date.now()}`,
          sender: 'assistant',
          text: `Support ticket ${res.ticket.case_number} has been logged with our Birgunj customer operations team. Our operations lead will review your case and respond shortly.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      showToast(err.message || 'Could not create support ticket.', 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open Wear Birgunj Support Chat"
            className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-slate-900 to-[#1E293B] text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border border-slate-700/60"
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-rose-400 group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-tight">Birgunj Support</p>
              <p className="text-[10px] text-slate-400 font-medium">AI Assistant Active</p>
            </div>
          </button>
        )}
      </div>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[92vw] sm:w-[410px] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  Wear Birgunj Assistant
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                    Online
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Birgunj Hyperlocal Commerce Support
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTicketModal(true)}
                title="Create Support Ticket"
                className="p-1.5 rounded-xl hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1 font-medium"
              >
                <Ticket className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline text-[11px]">Ticket</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                aria-label="Close Support Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="bg-slate-50 border-b border-slate-200/70 p-2 overflow-x-auto flex gap-1.5 no-scrollbar">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 shadow-2xs transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAFBFD]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-end ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 text-xs">
                    <Bot className="w-4 h-4 text-rose-400" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-black/5 text-[9px] opacity-60">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'assistant' && (
                      <span className="font-semibold uppercase tracking-wider text-[8px]">
                        Wear Birgunj AI
                      </span>
                    )}
                  </div>

                  {msg.ticketPrompt && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">Need human review?</span>
                      <button
                        type="button"
                        onClick={() => setShowTicketModal(true)}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <Ticket className="w-3 h-3" /> Create Official Ticket
                      </button>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 text-xs font-bold">
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-rose-400" />
                </div>
                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 border border-slate-200/80 shadow-2xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about orders, delivery, or returns..."
                disabled={isLoading}
                className="flex-1 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-slate-400 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-[#E11D48] text-white flex items-center justify-center disabled:opacity-40 disabled:hover:bg-slate-900 transition-colors shadow-sm shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
              <span>Birgunj SLA: 36h Returns • 2-4h Delivery</span>
              <button
                type="button"
                onClick={() => setShowTicketModal(true)}
                className="text-rose-600 hover:underline font-semibold"
              >
                Log Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Create Customer Support Ticket
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct escalation to Wear Birgunj Operations Lead
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issue Subject *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Size exchange request follow-up or delivery query"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e: any) => setTicketCategory(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white"
                  >
                    <option value="ORDER_ISSUE">Order Issue</option>
                    <option value="RETURN_EXCHANGE">Return / 36-Hr Exchange</option>
                    <option value="DELIVERY">Delivery Delay / Rajesh Kumar</option>
                    <option value="PAYMENT">Payment (eSewa/Khalti/COD)</option>
                    <option value="OTHER">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ord-wb123455"
                    value={ticketOrderId}
                    onChange={(e) => setTicketOrderId(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Description * (min 10 chars)
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your issue in detail. Include item names, sizes, or delivery address landmarks."
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-slate-50 focus:bg-white focus:border-slate-500 resize-none"
                />
                <div className="text-[11px] text-right text-slate-400 mt-1">
                  {ticketDescription.length}/2000 characters
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket || ticketDescription.length < 10}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-bold disabled:opacity-40 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isSubmittingTicket ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
