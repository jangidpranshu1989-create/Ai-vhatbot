import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider 
} from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  User as UserIcon, 
  LogOut, 
  Search, 
  Zap, 
  Brain, 
  ShieldCheck,
  Image as ImageIcon,
  Loader2,
  Menu,
  X,
  Globe,
  Code,
  Mic,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { generateResponse, ModelType } from './services/ai';
import { Chat, Message } from './types';
import VoiceMode from './components/VoiceMode';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [modelType, setModelType] = useState<ModelType>('flash');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // Sync user to Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatList);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'chats', currentChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgList);
    });
    return unsubscribe;
  }, [currentChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const createNewChat = async () => {
    if (!user) return;
    const docRef = await addDoc(collection(db, 'chats'), {
      userId: user.uid,
      title: 'New Sigma Chat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    setCurrentChatId(docRef.id);
    setSidebarOpen(window.innerWidth > 768);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedImage({ data: base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || isSending || !user) return;

    let chatId = currentChatId;
    if (!chatId) {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: input.slice(0, 30) || 'Image Analysis',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      chatId = docRef.id;
      setCurrentChatId(chatId);
    }

    const userMessage = input;
    const currentImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setIsSending(true);

    try {
      // Save user message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'user',
        content: userMessage || (currentImage ? "[Image Uploaded]" : ""),
        createdAt: serverTimestamp()
      });

      // Update chat timestamp
      await setDoc(doc(db, 'chats', chatId), { updatedAt: serverTimestamp() }, { merge: true });

      // Generate AI response
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await generateResponse(userMessage, modelType, history, currentImage || undefined);

      // Save AI message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'assistant',
        content: response.text,
        model: response.model,
        groundingMetadata: response.groundingMetadata || null,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-emerald-500">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-md"
        >
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-500/20 blur-3xl rounded-full" />
            <ShieldCheck className="w-24 h-24 text-emerald-500 mx-auto relative" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-white tracking-tighter">VibeAI</h1>
            <p className="text-slate-400 text-lg">Sigma Bhai is waiting. Billion-dollar startup logic ready.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 group"
          >
            <Globe className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Enter Sigma Mode
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex overflow-hidden text-slate-200 font-sans">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-72 border-r border-slate-800 bg-slate-900/50 flex flex-col z-50 fixed md:relative h-full"
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <h2 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6" /> VibeAI
              </h2>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <button 
                onClick={createNewChat}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> New Sigma Project
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setCurrentChatId(chat.id)}
                  className={cn(
                    "w-full p-3 rounded-xl text-left text-sm transition-all flex items-center gap-3 group",
                    currentChatId === chat.id ? "bg-emerald-500/10 text-emerald-400" : "hover:bg-slate-800/50 text-slate-400"
                  )}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-3 mb-4">
                <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-emerald-500/30" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{user.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">Sigma User</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full py-2 px-3 hover:bg-red-500/10 text-red-400 rounded-lg flex items-center gap-2 transition-colors text-xs font-medium"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        <AnimatePresence>
          {voiceModeOpen && <VoiceMode onClose={() => setVoiceModeOpen(false)} />}
        </AnimatePresence>

        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Mode:</span>
              <div className="flex bg-slate-900 p-1 rounded-lg gap-1">
                {[
                  { id: 'flash', icon: Zap, label: 'Flash' },
                  { id: 'pro', icon: Code, label: 'Pro' },
                  { id: 'search', icon: Search, label: 'Search' },
                  { id: 'maps', icon: MapPin, label: 'Maps' },
                  { id: 'thinking', icon: Brain, label: 'Think' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setModelType(mode.id as ModelType)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all",
                      modelType === mode.id ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <mode.icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => setVoiceModeOpen(true)}
              className="p-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg transition-all flex items-center gap-2 text-xs font-bold border border-emerald-500/20"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Voice Mode</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <ShieldCheck className="w-16 h-16 text-emerald-500" />
              <div>
                <h3 className="text-xl font-bold">VibeAI Orchestrator</h3>
                <p className="text-sm">Bhai, billion-dollar idea hai kya? Coding error fix karun?</p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 max-w-4xl mx-auto",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  msg.role === 'user' ? "bg-emerald-600" : "bg-slate-800"
                )}>
                  {msg.role === 'user' ? <UserIcon className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                </div>
                <div className={cn(
                  "space-y-2 max-w-[85%]",
                  msg.role === 'user' ? "text-right" : "text-left"
                )}>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' ? "bg-emerald-600/10 text-emerald-50 border border-emerald-500/20" : "bg-slate-900/50 border border-slate-800"
                  )}>
                    <div className="prose prose-invert prose-emerald max-w-none">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {msg.groundingMetadata?.groundingChunks && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => (
                        chunk.web ? (
                          <a 
                            key={idx} 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md text-emerald-400 flex items-center gap-1 transition-colors"
                          >
                            <Globe className="w-3 h-3" /> {chunk.web.title || 'Source'}
                          </a>
                        ) : chunk.maps ? (
                          <a 
                            key={idx} 
                            href={chunk.maps.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md text-emerald-400 flex items-center gap-1 transition-colors"
                          >
                            <MapPin className="w-3 h-3" /> {chunk.maps.title || 'Place'}
                          </a>
                        ) : null
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
          <form 
            onSubmit={sendMessage}
            className="max-w-4xl mx-auto relative group"
          >
            {selectedImage && (
              <div className="absolute bottom-full mb-4 left-0 p-2 bg-slate-900 rounded-xl border border-emerald-500/30 flex items-center gap-2">
                <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="w-12 h-12 object-cover rounded-lg" />
                <button 
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="p-1 hover:bg-slate-800 rounded-full text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="relative flex items-end gap-2 bg-slate-900/80 border border-slate-800 focus-within:border-emerald-500/50 rounded-2xl p-2 transition-all shadow-2xl">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*" 
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Bhai, kya scene hai? Billion-dollar startup banayein?"
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 max-h-32 resize-none"
                rows={1}
              />
              <button 
                type="submit"
                disabled={isSending || (!input.trim() && !selectedImage)}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/20"
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[10px] text-center mt-2 text-slate-600 uppercase tracking-widest font-bold">
              Powered by Gemini 3 • Sigma Orchestrator v1.0
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
