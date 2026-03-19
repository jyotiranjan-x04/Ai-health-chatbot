/**
 * Browser Speech Recognition & Speech Synthesis helpers.
 */

// ── Speech Recognition (STT) ────────────────────

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

type SpeechCallback = (transcript: string, isFinal: boolean) => void;

let recognition: any = null;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

export function startListening(
  onResult: SpeechCallback,
  onEnd?: () => void,
  onError?: (error: string) => void
): void {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError?.("Speech recognition not supported in this browser");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'aborted' || event.error === 'no-speech') {
      return; // Silently ignore expected manual aborts or silence timeouts
    }
    onError?.(event.error || "Recognition error");
  };

  recognition.onend = () => {
    onEnd?.();
  };

  recognition.start();
}

export function stopListening(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

// ── Speech Synthesis (TTS) ──────────────────────

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.speechSynthesis;
}

export function speakText(
  text: string,
  onEnd?: () => void
): void {
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.1; // Slightly higher pitch for female tuning
  utterance.volume = 1;
  utterance.lang = "en-IN"; // Set base language to Indian English

  // Try to find a good female Indian English voice
  const voices = window.speechSynthesis.getVoices();
  
  let preferred = voices.find(
    (v) =>
      v.lang.includes("en-IN") &&
      (v.name.includes("Female") || 
       v.name.includes("Neerja") || 
       v.name.includes("Veena") || 
       v.name.includes("Google"))
  );

  // Fallback to any Indian English voice
  if (!preferred) {
    preferred = voices.find((v) => v.lang.includes("en-IN"));
  }

  if (preferred) utterance.voice = preferred;

  utterance.onend = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
