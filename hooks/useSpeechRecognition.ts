"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechErrorCode = "not-allowed" | "no-speech" | "aborted" | "network" | "unsupported" | "unknown";

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinalText?: (text: string) => void;
  onInterimText?: (text: string) => void;
  onError?: (code: SpeechErrorCode, detail?: string) => void;
  onEnd?: () => void;
}

function normalizeErrorCode(raw?: string): SpeechErrorCode {
  if (!raw) return "unknown";
  if (raw === "not-allowed" || raw === "no-speech" || raw === "aborted" || raw === "network") {
    return raw;
  }
  return "unknown";
}

export function useSpeechRecognition(options: SpeechRecognitionOptions = {}) {
  const {
    lang = "zh-CN",
    continuous = true,
    interimResults = true,
    onFinalText,
    onInterimText,
    onError,
    onEnd,
  } = options;

  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");

  const callbackRef = useRef({
    onFinalText,
    onInterimText,
    onError,
    onEnd,
  });
  callbackRef.current = { onFinalText, onInterimText, onError, onEnd };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      callbackRef.current.onError?.("unsupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalText.trim()) {
        callbackRef.current.onFinalText?.(finalText.trim());
      }
      setInterimText(interim);
      callbackRef.current.onInterimText?.(interim);
    };

    recognition.onerror = (event: any) => {
      const code = normalizeErrorCode(event?.error);
      callbackRef.current.onError?.(code, event?.error);
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      callbackRef.current.onEnd?.();
    };

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [continuous, interimResults, lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      callbackRef.current.onError?.("unsupported");
      return false;
    }
    try {
      recognitionRef.current.start();
      setIsListening(true);
      return true;
    } catch {
      callbackRef.current.onError?.("unknown");
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {}
    setIsListening(false);
    setInterimText("");
  }, []);

  return useMemo(
    () => ({
      isSupported,
      isListening,
      interimText,
      startListening,
      stopListening,
    }),
    [interimText, isListening, isSupported, startListening, stopListening]
  );
}
