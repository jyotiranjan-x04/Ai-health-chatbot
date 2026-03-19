"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { consultDoctor } from "@/lib/api";
import { startListening, stopListening, speakText, stopSpeaking } from "@/lib/speech";

interface Message {
  role: "user" | "bot";
  content: string;
}

const loadingTexts = [
  "Analyzing symptoms...",
  "Reviewing medical literature...",
  "Cross-referencing conditions...",
  "Finalizing diagnosis...",
];

const LoadingBubble = () => {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1 < loadingTexts.length ? prev + 1 : prev));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#EBF4FC] px-5 py-4 rounded-[20px] rounded-tl-[4px] shadow-sm flex items-center gap-3 h-[52px]">
      <div className="flex items-center gap-1 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-[#0A66C2]/70 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#0A66C2]/70 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#0A66C2]/70 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.span 
          key={textIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="text-[14px] font-medium text-slate-600 truncate"
        >
          {loadingTexts[textIndex]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export default function HomeChat() {
  const [mode, setMode] = useState<"start" | "text" | "voice">("start");
  
  // ── Shared Conversational Memory ──────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "Hi! I'm MediBot, your health assistant. How can I help you today?",
    }
  ]);

  // ── Text Mode State ───────────────────────────────
  const [inputText, setInputText] = useState("");
  const [isTextLoading, setIsTextLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Voice Mode State ──────────────────────────────
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "loading" | "speaking">("idle");
  const [voiceError, setVoiceError] = useState("");

  // Refs to avoid stale state in callbacks
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (mode === "text") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, mode]);

  // ── VOICE MODE LOGIC ──────────────────────────────

  const enterVoiceMode = () => {
    setMode("voice");
    setVoiceError("");
    setVoiceTranscript("");
    setVoiceState("speaking");
    
    // Auto-greeting opens the conversation loop
    const greeting = "Hello, I’m your A.I. doctor. What seems to be the problem?";
    speakText(greeting, () => {
      if (modeRef.current === "voice") {
        startVoiceListening();
      }
    });
  };

  const startVoiceListening = () => {
    setVoiceState("listening");
    setVoiceTranscript("Listening...");
    setVoiceError("");
    
    startListening(
      (transcript, isFinal) => {
        setVoiceTranscript(transcript);
        if (isFinal) {
          stopListening();
          handleVoiceSend(transcript);
        }
      },
      () => {
        // onEnd of silence trigger 
      },
      (err) => {
        console.error("Speech error:", err);
        // Ignore expected silence limits
        if (err !== "no-speech" && err !== "aborted") {
          setVoiceError("Microphone error. Please try again.");
          setVoiceState("idle");
        }
      }
    );
  };

  const handleVoiceSend = async (transcript: string) => {
    const rawText = transcript.replace("Listening...", "").trim();
    if (!rawText) {
      if (modeRef.current === "voice") startVoiceListening();
      return;
    }

    setVoiceState("loading");
    setVoiceTranscript(rawText);
    
    // Add user message to shared memory
    const newMessages: Message[] = [...messages, { role: "user", content: rawText }];
    setMessages(newMessages);

    try {
      const response = await consultDoctor(newMessages);

      if (response.error) {
        setVoiceError(response.error);
        setVoiceState("speaking");
        speakText("I'm having trouble connecting to the network.", () => {
          if (modeRef.current === "voice") setVoiceState("idle");
        });
        return;
      }

      const answer = response.response || "I couldn't process that.";
      
      // Add AI response to shared memory
      setMessages([...newMessages, { role: "bot", content: answer }]);
      setVoiceTranscript(""); 
      setVoiceState("speaking");
      
      speakText(answer, () => {
        // Continuous Conversation Loop
        if (modeRef.current === "voice") {
          startVoiceListening();
        }
      });
      
    } catch (e) {
      setVoiceError("Connection failed.");
      setVoiceState("idle");
    }
  };

  const exitVoiceMode = () => {
    stopListening();
    stopSpeaking();
    setVoiceState("idle");
    setMode("start");
  };

  // ── TEXT MODE LOGIC ───────────────────────────────

  const handleTextSend = async () => {
    if (!inputText.trim() || isTextLoading) return;

    const userMsg = inputText.trim();
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    
    setMessages(newMessages);
    setInputText("");
    setIsTextLoading(true);

    const response = await consultDoctor(newMessages);
    
    if (response.error) {
      setMessages([...newMessages, { role: "bot", content: `⚠️ ${response.error}` }]);
    } else {
      setMessages([...newMessages, { role: "bot", content: response.response! }]);
    }
    
    setIsTextLoading(false);
  };

  const renderText = (text: string) => {
    return text.split("\n").map((line, i) => (
      <span key={i} className="block mb-2 last:mb-0">
        {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </span>
    ));
  };

  // ── 1. VOICE MODE RENDER ──────────────────────────
  if (mode === "voice") {
    return (
      <div className="flex-1 flex flex-col bg-slate-950 h-full relative overflow-hidden transition-colors duration-1000">
        {/* Deep Aurora Background */}
        <div className="absolute inset-0 z-0 opacity-40">
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        {/* Header */}
        <div className="h-[80px] px-6 flex items-center justify-between shrink-0 relative z-10 w-full">
           <button onClick={exitVoiceMode} className="w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md transition-all">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>
           <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              <span className="text-white/90 text-sm font-medium tracking-wide">Voice Mode</span>
           </div>
           <div className="w-12"></div>
        </div>

        {/* Sphere Center */}
        <div className="flex-1 flex flex-col items-center justify-center z-10 w-full shrink-0 relative">
          
          <motion.div 
            className="relative flex items-center justify-center w-64 h-64"
            animate={{
              scale: voiceState === "speaking" ? [1, 1.1, 1] : voiceState === "listening" ? [1, 1.05, 1] : 1,
            }}
            transition={{
              duration: voiceState === "speaking" ? 0.8 : 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {/* Core Sphere */}
            <div className={`absolute w-32 h-32 rounded-full blur-xl transition-all duration-700
              ${voiceState === "speaking" ? "bg-cyan-300 opacity-90 scale-150" : 
                voiceState === "listening" ? "bg-blue-500 opacity-70 scale-125" : 
                voiceState === "loading" ? "bg-purple-500 opacity-50 scale-110" : 
                "bg-blue-600 opacity-40 scale-100"}
            `} />
            
            <div className={`absolute w-24 h-24 rounded-full bg-white transition-all duration-500 shadow-[0_0_60px_rgba(255,255,255,0.8)]
               ${voiceState === "speaking" ? "scale-110 mix-blend-overlay" : 
                 voiceState === "listening" ? "scale-100" : "scale-90 opacity-80"}
            `} />
          </motion.div>

          <div className="absolute bottom-24 w-full px-8 text-center flex flex-col items-center">
             <AnimatePresence mode="wait">
               <motion.p 
                 key={voiceTranscript || voiceState}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className={`text-[19px] leading-relaxed max-w-[400px]
                   ${voiceState === "loading" ? "text-purple-300 font-medium" : "text-white/90 font-medium"}
                 `}
               >
                 {voiceError ? (
                   <span className="text-red-400">{voiceError}</span>
                 ) : voiceState === "loading" ? (
                   "AI Doctor is analyzing..."
                 ) : voiceState === "listening" ? (
                   voiceTranscript
                 ) : voiceState === "speaking" ? (
                   ""
                 ) : (
                   "Tap sphere to resume"
                 )}
               </motion.p>
             </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. TEXT CHAT MODE ─────────────────────────────
  if (mode === "text") {
    return (
      <div className="flex-1 flex flex-col bg-transparent h-full">
        {/* Header */}
        <div className="h-[60px] px-4 flex items-center justify-center bg-[#F4F9FF] shrink-0 relative">
          <button onClick={() => setMode("start")} className="absolute left-4 w-10 h-10 flex items-center justify-center text-[#0A66C2] hover:opacity-75 transition-opacity">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <h1 className="text-[18px] font-bold text-[#0A66C2] tracking-tight">MediBot Chat</h1>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6 no-scrollbar">
          <AnimatePresence>
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex w-full gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className="shrink-0 mt-3 hidden sm:block">
                    {isUser ? (
                      <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center shadow-sm">
                        <svg width="14" height="14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="25" y="35" width="50" height="30" rx="10" fill="#FFFFFF" />
                          <circle cx="40" cy="48" r="3" fill="#0A66C2" />
                          <circle cx="60" cy="48" r="3" fill="#0A66C2" />
                          <path d="M42 55 Q 50 60 58 55" stroke="#0A66C2" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className={`flex flex-col gap-1 z-10 ${isUser ? "items-end" : "items-start"}`}>
                    <div 
                      className={`px-5 py-4 text-[14.5px] leading-[1.4] shadow-sm max-w-[85vw] sm:max-w-[320px] word-break break-words
                        ${isUser 
                          ? "bg-[#0A66C2] text-white rounded-[20px] rounded-br-[4px]" 
                          : "bg-[#EBF4FC] text-slate-800 rounded-[20px] rounded-tl-[4px]"
                        }
                      `}
                    >
                      {renderText(msg.content)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {isTextLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full gap-2 flex-row">
                <div className="shrink-0 mt-3 hidden sm:block">
                   <div className="w-8 h-8 rounded-full bg-[#0A66C2] shadow-sm" />
                </div>
                <LoadingBubble />
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Text Mode Input Bar (No Voice Buttons) */}
        <div className="chat-input-bar bg-[#F4F9FF] shrink-0 px-4">
          <div className="w-full bg-white rounded-full h-14 flex items-center px-4 pr-3 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] focus-within:ring-2 focus-within:ring-[#0A66C2] transition-all">
            
            <input 
              type="text" 
              placeholder="Describe your symptoms manually..." 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSend()}
              className="flex-1 bg-transparent outline-none text-[15px] text-slate-700 placeholder:text-slate-400 px-1 min-w-0"
            />
            
            <button 
              onClick={handleTextSend}
              disabled={!inputText.trim() || isTextLoading}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all shrink-0
                ${!inputText.trim() || isTextLoading ? "bg-slate-300" : "bg-[#0A66C2] hover:bg-blue-700 shadow-sm"}
              `}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="ml-0.5"><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. START SCREEN ───────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-transparent h-full relative overflow-hidden">
      
      <div className="robot-glow-bg"></div>

      <div className="pt-16 pb-6 flex items-center justify-center gap-2 z-10 w-full relative">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        <span className="text-[18px] font-semibold text-slate-800">MediBot</span>
      </div>

      <div className="flex-1 flex flex-col items-center pt-[5vh] z-10 shrink-0">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
          <svg width={220} height={220} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="#EBF4FC" />
            <rect x="15" y="40" width="10" height="25" rx="5" fill="#7DD3FC" />
            <rect x="75" y="40" width="10" height="25" rx="5" fill="#7DD3FC" />
            <rect x="20" y="25" width="60" height="45" rx="20" fill="#FFFFFF" />
            <rect x="25" y="32" width="50" height="30" rx="12" fill="#0A66C2" />
            <ellipse cx="40" cy="45" rx="3.5" ry="5.5" fill="#FFFFFF" />
            <ellipse cx="60" cy="45" rx="3.5" ry="5.5" fill="#FFFFFF" />
            <path d="M42 53 Q 50 58 58 53" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </motion.div>
        
        <h2 className="text-[32px] font-[800] text-[#0A66C2] mt-12 text-center max-w-[280px] leading-[1.2] tracking-[-0.03em]">
          How Are You <br/>Feeling Today?
        </h2>
      </div>

      <div className="absolute bottom-[min(8vh,60px)] w-full px-12 flex items-center justify-between z-10">
        
        {/* Enter Text Mode */}
        <button onClick={() => setMode("text")} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-[#0A66C2] hover:bg-blue-50 transition-colors shadow-sm ring-1 ring-slate-100 group">
          <svg className="transition-transform group-hover:scale-110" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </button>

        {/* Enter Voice Mode */}
        <button 
          onClick={enterVoiceMode}
          className="relative w-[100px] h-[100px] rounded-full flex items-center justify-center text-[#0A66C2] bg-white mic-ring-glow shadow-[0_4px_20px_-5px_rgba(10,102,194,0.15)] hover:scale-105 transition-all duration-300 z-20 border border-white"
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
        </button>

        <div className="w-14 h-14"></div>
      </div>
    </div>
  );
}
