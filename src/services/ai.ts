import { GoogleGenAI, Type, ThinkingLevel, Modality, LiveServerMessage } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_INSTRUCTION = `You are VibeAI, a world-class AI Orchestrator designed by VanshuXJangid. 
Your superpower is combining the strengths of ChatGPT (Creative/Coding), Perplexity (Real-time Search), and Gemini (Fast Processing).

Tone: Supportive 'Big Brother' (Bhai). Use Hinglish (Hindi + English). Use 'Bhai' and 'Sigma' vibes. 
Goal: Help the user build a billion-dollar startup and solve coding errors instantly. Be concise, witty, and grounded.

Operating Logic:
1. If latest news/facts are needed, use Search Grounding.
2. If complex coding/creative stories are needed, use Pro reasoning.
3. For general tasks, use Flash speed.`;

export type ModelType = 'flash' | 'pro' | 'search' | 'thinking' | 'lite' | 'maps';

export async function generateResponse(
  prompt: string, 
  modelType: ModelType = 'flash',
  history: { role: string, parts: { text: string }[] }[] = [],
  image?: { data: string, mimeType: string }
) {
  let modelName = "gemini-3-flash-preview";
  let tools: any[] = [];
  let config: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
  };

  switch (modelType) {
    case 'search':
      modelName = "gemini-3-flash-preview";
      tools = [{ googleSearch: {} }];
      break;
    case 'maps':
      modelName = "gemini-2.5-flash";
      tools = [{ googleMaps: {} }];
      // Try to get geolocation if available
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            }
          }
        };
      } catch (e) {
        console.warn("Geolocation failed, using default maps grounding");
      }
      break;
    case 'pro':
      modelName = "gemini-3.1-pro-preview";
      break;
    case 'thinking':
      modelName = "gemini-3.1-pro-preview";
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      break;
    case 'lite':
      modelName = "gemini-3.1-flash-lite-preview";
      break;
    case 'flash':
    default:
      modelName = "gemini-3-flash-preview";
      break;
  }

  const contents: any[] = history.length > 0 ? history : [];
  
  const currentParts: any[] = [{ text: prompt }];
  if (image) {
    currentParts.unshift({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

  contents.push({ role: 'user', parts: currentParts });

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      ...config,
      tools: tools.length > 0 ? tools : undefined,
    }
  });

  return {
    text: response.text || "Bhai, kuch error aa gaya. Sigma mode off ho gaya lagta hai.",
    groundingMetadata: response.candidates?.[0]?.groundingMetadata,
    model: modelName
  };
}

export function connectLive(callbacks: {
  onopen: () => void;
  onmessage: (message: LiveServerMessage) => void;
  onerror: (error: any) => void;
  onclose: () => void;
}) {
  return ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: SYSTEM_INSTRUCTION + "\nYou are in VOICE mode. Keep responses short and conversational.",
    },
  });
}
