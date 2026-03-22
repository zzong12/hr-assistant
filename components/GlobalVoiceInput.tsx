"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { toast } from "sonner";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

function isTextInput(el: Element | null): el is EditableElement {
  if (!el) return false;
  if (el instanceof HTMLElement && el.dataset.voiceLocal === "true") return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.readOnly || el.disabled) return false;

  const unsupportedTypes = new Set([
    "checkbox",
    "radio",
    "file",
    "number",
    "range",
    "date",
    "time",
    "datetime-local",
    "month",
    "week",
    "color",
    "hidden",
  ]);
  return !unsupportedTypes.has(el.type);
}

function appendTextToElement(target: EditableElement, text: string) {
  const safeText = text.trim();
  if (!safeText) return;
  const current = target.value ?? "";
  const merged = current.trim() ? `${current} ${safeText}` : safeText;
  target.value = merged;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

export function GlobalVoiceInput() {
  const [target, setTarget] = useState<EditableElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onFinalText = useCallback(
    (text: string) => {
      if (!target) return;
      appendTextToElement(target, text);
    },
    [target]
  );

  const onError = useCallback((code: string) => {
    if (code === "not-allowed") {
      toast.error("麦克风权限被拒绝，请在浏览器设置中开启");
      return;
    }
    if (code === "unsupported") {
      toast.error("当前浏览器不支持语音识别");
    }
  }, []);

  const { isSupported, isListening, interimText, startListening, stopListening } = useSpeechRecognition({
    onFinalText,
    onError,
    lang: "zh-CN",
    continuous: true,
    interimResults: true,
  });

  useEffect(() => {
    const handleFocus = (event: FocusEvent) => {
      const el = event.target as Element | null;
      if (isTextInput(el)) {
        setTarget(el);
      } else {
        setTarget(null);
      }
    };
    const handleBlur = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (containerRef.current?.contains(active)) {
          return;
        }
        if (!isTextInput(active)) {
          setTarget(null);
          stopListening();
        }
      }, 0);
    };
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
    };
  }, [stopListening]);

  const isVisible = useMemo(() => Boolean(target) && isSupported, [target, isSupported]);
  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-[70] electron-no-drag">
      <div className="rounded-2xl border border-border-primary bg-bg-card/95 backdrop-blur-md shadow-xl px-2 py-2 flex items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant={isListening ? "destructive" : "outline"}
          onMouseDown={(e) => {
            // Keep focus on text field so voice widget does not immediately lose target.
            e.preventDefault();
          }}
          onClick={() => {
            if (isListening) {
              stopListening();
              return;
            }
            const started = startListening();
            if (started) toast.success("开始语音录入");
          }}
          title={isListening ? "停止语音录入" : "开始语音录入"}
        >
          {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <div className="text-[11px] text-text-secondary max-w-[220px] truncate">
          {isListening ? interimText || "正在监听..." : "语音录入"}
        </div>
      </div>
    </div>
  );
}
