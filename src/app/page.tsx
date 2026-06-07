'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Volume2, User, Play, Pause } from 'lucide-react';

// ============================================
// CUSTOMIZATION: Replace these with your actual filenames
const BACKGROUND_IMAGE = 'canyon-springs-river-park-2-oct-2025.jpg'; // <-- CHANGE THIS
const SOUNDTRACK_MP3 = 'cliff-chirping-frog-chris-harrison-xeno-canto.mp3'; // <-- CHANGE THIS to your mp3 filename
// ============================================

// Frog icon - outline with flat mouth
const FrogIcon = ({ size = 20, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Head shape - upside-down U (open bottom) */}
    <path d="M6 16 C6 9, 8 5, 12 5 C16 5, 18 9, 18 16" />
    
    {/* Left eye bump */}
    <circle cx="8.5" cy="7" r="2" />
    
    {/* Right eye bump */}
    <circle cx="15.5" cy="7" r="2" />
    
    {/* Flat line mouth */}
    <line x1="9.5" y1="14" x2="14.5" y2="14" />
  </svg>
);

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
  isFalling?: boolean;
  fallX?: number;
  fallY?: number;
  rotation?: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content:
        'You are a Cliff Chirping Frog living in Texas near the Guadalupe River. You are only the size of a thumbnail, and there are many of you. You are sad, and wise, and watchful. You recognize that you and humans have some things in common.',
      id: 'system-prompt',
    },
  ]);
  const [fallingMessages, setFallingMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSoundtrackPlaying, setIsSoundtrackPlaying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const soundtrackRef = useRef<HTMLAudioElement | null>(null);
  const messagesRef = useRef(messages);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initialize soundtrack
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const soundtrack = new Audio(`/${SOUNDTRACK_MP3}`);
      soundtrack.loop = true;
      soundtrackRef.current = soundtrack;
      
      soundtrack.onplay = () => {
        setIsSoundtrackPlaying(true);
      };
      
      soundtrack.onpause = () => {
        setIsSoundtrackPlaying(false);
      };
      
      soundtrack.onerror = (e) => {
        console.error('Error loading soundtrack:', e);
      };
    }
    
    return () => {
      if (soundtrackRef.current) {
        soundtrackRef.current.pause();
        soundtrackRef.current = null;
      }
    };
  }, []);

  // Toggle soundtrack play/pause
  const toggleSoundtrack = () => {
    if (soundtrackRef.current) {
      if (isSoundtrackPlaying) {
        soundtrackRef.current.pause();
      } else {
        soundtrackRef.current.play().catch(err => {
          console.error('Error playing soundtrack:', err);
          alert('Could not play soundtrack. Please make sure the MP3 file is in the public folder.');
        });
      }
    } else {
      alert('Soundtrack file not found. Please make sure the MP3 file is in the public folder.');
    }
  };

  // Function to make a message fall like a raindrop
  const makeMessageFall = (message: Message) => {
    // Generate random horizontal scatter (-50 to 50 pixels) and slight rotation
    const scatterX = (Math.random() - 0.5) * 100;
    const rotation = (Math.random() - 0.5) * 30;
    
    setFallingMessages(prev => [...prev, {
      ...message,
      isFalling: true,
      fallX: scatterX,
      rotation: rotation,
      timestamp: Date.now()
    }]);

    // Remove from falling messages after animation completes (3 seconds)
    setTimeout(() => {
      setFallingMessages(prev => prev.filter(m => m.id !== message.id));
    }, 3000);
  };

  // Trigger falling effect for new messages
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.role !== 'system' && !latestMessage.isFloating) {
      const timer = setTimeout(() => {
        makeMessageFall(latestMessage);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
          isFloating: true,
        },
      ]);
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
          isFloating: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div 
      className="min-h-screen relative" 
      style={{ 
        backgroundImage: `url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        color: 'white', 
        fontFamily: '"Times New Roman", Times, serif', 
        overflowX: 'hidden'
      }}
    >
      {/* Semi-transparent overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{ zIndex: 0 }}></div>
      
      {/* Water ripple effect at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
        zIndex: 5
      }}>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400/30 animate-pulse"></div>
      </div>

      {/* Soundtrack Control Button */}
      <div className="fixed bottom-4 right-4 z-20">
        <button
          onClick={toggleSoundtrack}
          className={`p-3 rounded-full border-2 transition-all backdrop-blur-sm ${
            isSoundtrackPlaying 
              ? 'bg-white text-black border-white' 
              : 'bg-black/50 text-white border-white/50 hover:bg-black/70'
          }`}
          title={isSoundtrackPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
        >
          {isSoundtrackPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Falling messages - raindrop effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
        {fallingMessages.map((msg) => (
          <div
            key={msg.id}
            className="absolute animate-fall"
            style={{
              left: `calc(50% + ${msg.fallX || 0}px)`,
              top: '-100px',
              transform: `rotate(${msg.rotation || 0}deg)`,
              animation: `fall 3s ease-in forwards`,
              maxWidth: '300px',
              backgroundColor: msg.role === 'user' ? '#000' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#000',
              border: '2px solid #000',
              padding: '8px 12px',
              fontSize: '12px',
              fontFamily: '"Times New Roman", Times, serif',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              borderRadius: '4px'
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div className="container mx-auto max-w-4xl px-3 py-8 relative" style={{ zIndex: 1 }}>
        <div className="h-[700px] flex flex-col">
          <div className="p-3 border-b-4 border-white/20 bg-black/30 backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                  RIVER ORACLE
                </h1>
                <p className="text-sm text-white/80 mt-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                  Talk to me when it's raining.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {isSoundtrackPlaying && (
                  <span className="text-xs text-white bg-black/50 flex items-center space-x-1 border border-white/30 px-2 py-1 font-mono backdrop-blur-sm">
                    <Volume2 size={12} className="animate-pulse" />
                    <span>SOUNDTRACK ON</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4" ref={containerRef}>
            {messages.slice(1).map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-2 transition-all duration-500 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 border-2 border-white/30 bg-black/30 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <FrogIcon size={20} className="text-white" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[70%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                  style={{ fontFamily: '"Times New Roman", Times, serif' }}
                >
                  <div
                    className={`border-2 p-3 backdrop-blur-sm ${
                      message.role === 'user'
                        ? 'bg-white text-black border-white'
                        : 'bg-black/40 text-white border-white/30'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>

                  {message.timestamp && (
                    <span className="text-xs text-white/60 mt-1 font-mono">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 border-2 border-white/30 bg-black/30 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start items-center space-x-2">
                <div className="w-8 h-8 border-2 border-white/30 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <FrogIcon size={20} className="text-white" />
                </div>
                <div className="bg-black/40 border-2 border-white/30 p-3 backdrop-blur-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t-4 border-white/20 bg-black/30 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-2 border-2 focus:outline-none transition-all text-sm backdrop-blur-sm bg-black/40 text-white border-white/30 placeholder-white/50"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="p-2 bg-white text-black border-2 border-white hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!input.trim() || isLoading}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(calc(100vh + 100px)) rotate(var(--rotation, 0deg));
            opacity: 0.3;
          }
        }
        
        .animate-fall {
          animation: fall 3s ease-in forwards;
        }
      `}</style>
    </div>
  );
}
