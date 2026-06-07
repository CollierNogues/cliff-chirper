'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User } from 'lucide-react';

// Custom frog icon component - minimalist angular frog (back slope, one leg, face)
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
    {/* Slope of the frog's back - curved/angled line from rear to head */}
    <path d="M5 16 L8 8 L14 6 L18 9" />
    
    {/* Frog leg - single angular back leg */}
    <polyline points="5,16 3,18.5 5.5,19" />
    
    {/* Frog face - angular, facing right */}
    {/* Jaw/chin line */}
    <polyline points="18,9 19.5,11 18.5,12.5" />
    
    {/* Eye - angular geometric */}
    <polygon points="16.5,7 18,6 18.5,7.5 17,8" />
    
    {/* Nostril/snout detail */}
    <line x1="19" y1="10" x2="20" y2="10.5" />
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
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(continuousListening);
  const messagesRef = useRef(messages);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  // Handle auto-submit from speech recognition with fresh state
  const handleAutoSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    console.log('handleAutoSubmit called with:', text);
    console.log('Current continuous listening:', continuousListeningRef.current);

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
          messages: [...messagesRef.current, userMessage].map((msg) => ({
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

      // ALWAYS auto-speak when called from speech recognition
      console.log('Auto-speaking response:', assistantMessage.content);
      await speakText(assistantMessage.content);
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
      
      await speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          console.log('Speech result received:', event.results);
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Result ${i}: ${transcript}, isFinal: ${event.results[i].isFinal}`);
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Show live transcription in input box
          if (interimTranscript) {
            console.log('Setting interim transcript:', interimTranscript);
            setInput(interimTranscript);
          }

          // When we get a final result (after silence), auto-submit
          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            console.log('Final transcript received:', fullText);
            console.log('Continuous listening ref:', continuousListeningRef.current);
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              // Stop listening while we process
              recognition.stop();
              // Auto-submit after a brief delay
              setTimeout(() => {
                console.log('Auto-submitting message:', fullText);
                handleAutoSubmit(fullText);
              }, 500);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        console.log('Speech recognition initialized');
      } else {
        console.error('Speech Recognition not supported in this browser');
        alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on cleanup');
        }
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Starting speech recognition...');
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started or error:', e);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        console.log('Stopping speech recognition...');
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
  };

  // Handle continuous listening restart after speech ends or AI finishes speaking
  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      console.log('Restarting speech recognition for continuous mode');
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  const startRecording = async () => {
    try {
      // If we already have a stream in continuous mode, just start a new recording
      if (continuousListening && streamRef.current) {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          
          // In continuous mode, restart recording after transcription (unless speaking)
          if (continuousListening && !isSpeaking) {
            setTimeout(() => startRecording(), 100);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

      // Initial setup - get the stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // In continuous mode, restart recording after transcription (unless speaking)
        if (continuousListening && !isSpeaking) {
          setTimeout(() => startRecording(), 100);
        } else if (!continuousListening) {
          // Clean up stream if not in continuous mode
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);

      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      alert(error.message || 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log('Sending text to speech API:', text);

      // Stop speech recognition while AI is speaking
      if (isListening) {
        stopSpeechRecognition();
      }
      // Also stop recording if using mic button
      if (isRecording) {
        stopRecording();
      }
      setIsSpeaking(true);

      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response from speech API:', response.status, errorData);
        throw new Error(errorData.error || `Failed to generate speech: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      console.log('Response content type:', contentType);

      if (!contentType || !contentType.includes('audio/mpeg')) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Invalid response format:', errorData);
        throw new Error(errorData.error || 'Response was not audio format');
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        console.error('Empty audio blob received');
        throw new Error('Empty audio received from API');
      }

      console.log('Audio blob received, size:', audioBlob.size);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onerror = (e) => {
        console.error('Error playing audio:', e);
        setIsSpeaking(false);
        // Resume speech recognition if in continuous mode
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio error');
          setTimeout(() => startSpeechRecognition(), 100);
        }
      };

      audio.onended = () => {
        console.log('Audio playback ended');
        setIsSpeaking(false);
        // Resume speech recognition after AI finishes speaking
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio ended');
          setTimeout(() => startSpeechRecognition(), 500);
        }
      };

      console.log('Starting audio playback...');
      await audio.play();
      console.log('Audio playback started');
    } catch (error: any) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);
      // Resume speech recognition if in continuous mode even on error
      if (continuousListeningRef.current) {
        setTimeout(() => startSpeechRecognition(), 100);
      }
      alert(error.message || 'Failed to generate speech');
    }
  };

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

      // Auto-speak the response in continuous listening mode
      console.log('Continuous listening:', continuousListening, 'Content:', assistantMessage.content);
      if (continuousListening) {
        console.log('Auto-speaking the response...');
        await speakText(assistantMessage.content);
      }
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
      
      // Also speak error message in continuous mode
      if (continuousListening) {
        await speakText(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#2d2d2d', color: 'white', fontFamily: '"Times New Roman", Times, serif', overflowX: 'hidden' }}>
      {/* Water ripple effect at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(45,45,45,0.9), transparent)',
        zIndex: 5
      }}>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400/30 animate-pulse"></div>
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
        {/* Removed white container with borders - now directly showing content on dark background */}
        <div className="h-[700px] flex flex-col">
          <div className="p-3 border-b-4 border-white/20">
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
                <label className={`flex items-center space-x-2 ${isSpeaking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <span className="text-xs text-white font-mono uppercase tracking-wider">Continuous Listen</span>
                  <button
                    onClick={async () => {
                      if (isSpeaking) return;
                      const newValue = !continuousListening;
                      if (newValue) {
                        try {
                          await navigator.mediaDevices.getUserMedia({ audio: true });
                          console.log('Microphone permission granted');
                          setContinuousListening(true);
                          startSpeechRecognition();
                        } catch (error) {
                          console.error('Microphone permission denied:', error);
                          alert('Please allow microphone access to use speech recognition');
                        }
                      } else {
                        setContinuousListening(false);
                        stopSpeechRecognition();
                        setInput('');
                      }
                    }}
                    disabled={isSpeaking}
                    className={`border-2 border-white px-3 py-1 text-xs font-mono transition-colors ${
                      continuousListening ? 'bg-white text-black' : 'bg-transparent text-white'
                    } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                  >
                    {continuousListening ? 'ON' : 'OFF'}
                  </button>
                </label>
                {isListening && !isSpeaking && (
                  <span className="text-xs text-white flex items-center space-x-1 border border-white px-2 py-1 font-mono">
                    <Mic size={12} className="animate-pulse" />
                    <span>LISTENING</span>
                  </span>
                )}
                {isSpeaking && (
                  <span className="text-xs text-black bg-white flex items-center space-x-1 border border-white px-2 py-1 font-mono">
                    <Volume2 size={12} className="animate-pulse" />
                    <span>SPEAKING</span>
                  </span>
                )}
                {continuousListening && !isListening && !isSpeaking && (
                  <span className="text-xs text-white border border-white px-2 py-1 font-mono">
                    PAUSED
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
                  <div className="w-8 h-8 border-2 border-white/30 bg-white/10 flex items-center justify-center flex-shrink-0">
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
                    className={`border-2 p-3 ${
                      message.role === 'user'
                        ? 'bg-white text-black border-white'
                        : 'bg-white/10 text-white border-white/30'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>

                  {message.role === 'assistant' && (
                    <button
                      onClick={() => speakText(message.content)}
                      className="mt-1 text-white/80 hover:text-white transition-opacity border border-white/30 px-2 py-1 bg-white/10 text-xs font-mono"
                      aria-label="Text to speech"
                    >
                      <div className="flex items-center space-x-1">
                        <Volume2 size={12} />
                        <span>PLAY</span>
                      </div>
                    </button>
                  )}

                  {message.timestamp && (
                    <span className="text-xs text-white/60 mt-1 font-mono">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 border-2 border-white/30 bg-white/10 flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start items-center space-x-2">
                <div className="w-8 h-8 border-2 border-white/30 bg-white/10 flex items-center justify-center">
                  <FrogIcon size={20} className="text-white" />
                </div>
                <div className="bg-white/10 border-2 border-white/30 p-3">
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

          <div className="p-3 border-t-4 border-white/20">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? ">>> LISTENING... SPEAK NOW" : "Type your message..."}
                className={`flex-1 p-2 border-2 focus:outline-none transition-all text-sm ${
                  isListening 
                    ? 'bg-white text-black border-white placeholder-black font-mono' 
                    : 'bg-white/10 text-white border-white/30 placeholder-white/50'
                }`}
                style={{ fontFamily: isListening ? 'monospace' : '"Times New Roman", Times, serif' }}
                disabled={isLoading}
                readOnly={isListening}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 border-2 transition-colors ${
                  isRecording
                    ? 'bg-white text-black border-white animate-pulse'
                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                }`}
                disabled={isLoading || continuousListening}
                title={continuousListening ? 'Mic is auto-managed in continuous mode' : 'Push to talk'}
              >
                {isRecording ? <Square size={18} /> : <Mic size={18} />}
              </button>
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
