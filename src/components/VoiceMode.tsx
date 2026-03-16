import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Loader2, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { connectLive } from '../services/ai';

interface VoiceModeProps {
  onClose: () => void;
}

export default function VoiceMode({ onClose }: VoiceModeProps) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlaying = useRef(false);

  useEffect(() => {
    startSession();
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      sessionRef.current = await connectLive({
        onopen: () => {
          setIsConnecting(false);
          setIsActive(true);
          setupAudioProcessing(stream);
        },
        onmessage: (message) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const binary = atob(base64Audio);
            const bytes = new Int16Array(binary.length / 2);
            for (let i = 0; i < bytes.length; i++) {
              bytes[i] = (binary.charCodeAt(i * 2) & 0xFF) | (binary.charCodeAt(i * 2 + 1) << 8);
            }
            audioQueue.current.push(bytes);
            if (!isPlaying.current) playNextInQueue();
          }
          if (message.serverContent?.interrupted) {
            audioQueue.current = [];
            isPlaying.current = false;
          }
        },
        onerror: (err) => {
          console.error('Live API Error:', err);
          setError('Bhai, connection toot gaya. Sigma mode unstable hai.');
        },
        onclose: () => {
          setIsActive(false);
        }
      });
    } catch (err) {
      console.error('Failed to start voice session:', err);
      setError('Bhai, mic access nahi mila. Sigma vibes blocked.');
      setIsConnecting(false);
    }
  };

  const setupAudioProcessing = (stream: MediaStream) => {
    if (!audioContextRef.current) return;

    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (e) => {
      if (!isActive) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
      }

      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      sessionRef.current?.sendRealtimeInput({
        media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
      });
    };

    sourceRef.current.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  };

  const playNextInQueue = async () => {
    if (audioQueue.current.length === 0 || !audioContextRef.current) {
      isPlaying.current = false;
      return;
    }

    isPlaying.current = true;
    const pcmData = audioQueue.current.shift()!;
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextInQueue();
    source.start();
  };

  const stopSession = () => {
    sessionRef.current?.close();
    sourceRef.current?.disconnect();
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    setIsActive(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="relative flex flex-col items-center space-y-12 max-w-md text-center">
        <div className="relative">
          <AnimatePresence>
            {isActive && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 0.2 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-emerald-500 rounded-full blur-3xl"
              />
            )}
          </AnimatePresence>
          
          <div className={cn(
            "w-48 h-48 rounded-full flex items-center justify-center relative z-10 transition-all duration-500 border-4",
            isActive ? "bg-emerald-600 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.4)]" : "bg-slate-800 border-slate-700"
          )}>
            {isConnecting ? (
              <Loader2 className="w-20 h-20 text-emerald-500 animate-spin" />
            ) : isActive ? (
              <Volume2 className="w-24 h-24 text-white animate-pulse" />
            ) : (
              <MicOff className="w-24 h-24 text-slate-500" />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl font-bold text-white tracking-tight">
            {isConnecting ? 'Connecting Sigma Voice...' : isActive ? 'Bhai is Listening...' : 'Voice Mode Offline'}
          </h2>
          <p className="text-slate-400 text-lg">
            {error || 'Direct conversation with the Sigma Orchestrator. Real-time vibes only.'}
          </p>
        </div>

        {isActive && (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <motion.div
                key={i}
                animate={{ height: [10, 40, 10] }}
                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                className="w-1.5 bg-emerald-500 rounded-full"
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
