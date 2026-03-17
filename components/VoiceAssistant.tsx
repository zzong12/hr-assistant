"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic, MicOff, Square, Loader2, AlertCircle, CheckCircle2, Sparkles, Volume2,
} from "lucide-react";
import { toast } from "sonner";
import type { InterviewQuestion, AnswerKeyPoint } from "@/lib/types";

interface VoiceAssistantProps {
  interviewId: string;
  questions: InterviewQuestion[];
  onTranscriptSave?: (transcript: string) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  basic: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  advanced: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  expert: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const LEVEL_LABELS: Record<string, string> = {
  basic: "基础", intermediate: "中级", advanced: "高级", expert: "专家",
};

export function VoiceAssistant({ interviewId, questions, onTranscriptSave }: VoiceAssistantProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [coveredPoints, setCoveredPoints] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const recognitionRef = useRef<any>(null);
  const analyzeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef("");
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        transcriptRef.current += final + "\n";
        setTranscript(transcriptRef.current);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        toast.error("麦克风权限被拒绝，请在浏览器设置中允许麦克风访问");
        setIsListening(false);
      } else if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
      toast.success("开始录音");
    } catch (err) {
      console.error("Failed to start:", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  const analyzeTranscript = useCallback(async () => {
    if (!transcript.trim() || analyzing) return;
    setAnalyzing(true);
    try {
      const currentQ = questions[currentQuestionIdx];
      const res = await fetch(`/api/interviews/${interviewId}/voice-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.slice(-2000),
          currentQuestion: currentQ,
          questionIndex: currentQuestionIdx,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions) setAiSuggestions(data.suggestions);
        if (data.coveredPointIds) {
          setCoveredPoints(prev => {
            const next = new Set(prev);
            data.coveredPointIds.forEach((id: string) => next.add(id));
            return next;
          });
        }
      }
    } catch {}
    finally { setAnalyzing(false); }
  }, [transcript, currentQuestionIdx, questions, interviewId, analyzing]);

  useEffect(() => {
    if (!isListening || !transcript) return;
    if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    analyzeTimerRef.current = setTimeout(analyzeTranscript, 8000);
  }, [transcript, isListening, analyzeTranscript]);

  const handleSaveTranscript = () => {
    if (onTranscriptSave && transcript.trim()) {
      onTranscriptSave(transcript);
      toast.success("转录记录已保存");
    }
  };

  const currentQuestion = questions[currentQuestionIdx];

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">浏览器不支持语音识别</p>
            <p className="text-sm">请使用 Chrome 或 Edge 浏览器以使用 AI 面试助手功能</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">AI 面试助手</span>
            {isListening && (
              <Badge variant="destructive" className="text-[10px] animate-pulse-soft">录音中</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {!isListening ? (
              <Button size="sm" onClick={startListening} className="gradient-primary text-white">
                <Mic className="w-4 h-4 mr-1" />开始录音
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopListening}>
                <Square className="w-4 h-4 mr-1" />停止
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={analyzeTranscript} disabled={analyzing || !transcript.trim()}>
              {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              分析
            </Button>
            {transcript.trim() && (
              <Button size="sm" variant="outline" onClick={handleSaveTranscript}>保存记录</Button>
            )}
          </div>
        </div>

        {/* Question selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">当前题目:</span>
          {questions.map((_, i) => (
            <Button
              key={i} size="sm" variant={i === currentQuestionIdx ? "default" : "outline"}
              className="h-6 w-6 p-0 text-xs"
              onClick={() => setCurrentQuestionIdx(i)}
            >{i + 1}</Button>
          ))}
        </div>
      </Card>

      {/* Current Question Details */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-primary" />当前题目内容
        </h4>
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">
                {currentQuestion?.category || "未分类"}
              </Badge>
              {currentQuestion?.difficulty && (
                <Badge variant="secondary" className="text-[10px]">
                  {currentQuestion.difficulty === "easy" ? "简单" :
                   currentQuestion.difficulty === "medium" ? "中等" :
                   currentQuestion.difficulty === "hard" ? "困难" : currentQuestion.difficulty}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium">{currentQuestion?.question || "无题目内容"}</p>
          </div>
          {currentQuestion?.purpose && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">考察目的</p>
              <p className="text-xs text-muted-foreground">{currentQuestion.purpose}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Transcript */}
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-2">实时转录</h4>
          <ScrollArea className="h-48">
            <div className="text-sm whitespace-pre-wrap text-muted-foreground">
              {transcript || "等待录音开始..."}
              {interimText && <span className="text-primary/60">{interimText}</span>}
            </div>
          </ScrollArea>
        </Card>

        {/* AI Suggestions */}
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />AI 建议
          </h4>
          <ScrollArea className="h-48">
            {aiSuggestions.length > 0 ? (
              <div className="space-y-2">
                {aiSuggestions.map((s, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{s}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">录音并分析后，AI 将在此给出实时建议</p>
            )}
          </ScrollArea>
        </Card>
      </div>

      {/* KeyPoints coverage for current question */}
      {currentQuestion?.keyPoints && currentQuestion.keyPoints.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3">
            题目 {currentQuestionIdx + 1} 关键点覆盖
          </h4>
          <div className="space-y-2">
            {currentQuestion.keyPoints.map((kp, i) => {
              const pointId = `${currentQuestionIdx}-${i}`;
              const isCovered = coveredPoints.has(pointId);
              return (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${isCovered ? "bg-green-50 dark:bg-green-950/30" : ""}`}>
                  {isCovered ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{kp.point}</span>
                      <Badge className={`text-[9px] h-4 px-1 ${LEVEL_COLORS[kp.level] || ""}`}>
                        {LEVEL_LABELS[kp.level] || kp.level}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{kp.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
