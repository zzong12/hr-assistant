import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Plus, Trash2, Sparkles, ChevronDown, ChevronUp, Zap,
} from "lucide-react";
import type { ScoringRule, ScoringDimension, Job } from "@/lib/types";

let counter = 0;
function generateId(): string {
  counter++;
  return `dim-${Date.now()}-${counter}`;
}

interface ScoringRuleEditorProps {
  job?: Job;
  initialRule?: ScoringRule;
  onRuleChange: (rule: ScoringRule) => void;
  onGenerate?: (criteria: string) => Promise<ScoringRule & { explanation?: string }>;
  ruleName?: string;
}

export function ScoringRuleEditor({ job, initialRule, onRuleChange, onGenerate, ruleName }: ScoringRuleEditorProps) {
  const [rule, setRule] = useState<ScoringRule>(() => {
    if (initialRule) {
      return { ...initialRule, dimensions: initialRule.dimensions || [] };
    }
    return {
      id: `rule-${generateId()}`,
      name: ruleName || (job ? `${job.title || ""}评估规则` : "新评估规则"),
      description: "",
      version: "1.0.0",
      dimensions: [],
      totalScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  const [naturalLanguageCriteria, setNaturalLanguageCriteria] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationExplanation, setGenerationExplanation] = useState("");
  const [validationError, setValidationError] = useState("");
  const prevRuleRef = useRef<ScoringRule | null>(null);
  const prevInitialRuleId = useRef<string | undefined>(initialRule?.id);

  useEffect(() => {
    if (initialRule && initialRule.id !== prevInitialRuleId.current) {
      prevInitialRuleId.current = initialRule.id;
      prevRuleRef.current = initialRule;
      setRule({ ...initialRule, dimensions: initialRule.dimensions || [] });
      setGenerationExplanation("");
      setNaturalLanguageCriteria("");
    }
  }, [initialRule]);

  const handleGenerateRule = async () => {
    if (!onGenerate || !naturalLanguageCriteria.trim()) return;
    setIsGenerating(true);
    setValidationError("");
    try {
      const result = await onGenerate(naturalLanguageCriteria);
      prevRuleRef.current = result;
      setRule(result);
      setGenerationExplanation(result.explanation || "");
      onRuleChange(result);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "生成失败，请重试");
      console.error("Rule generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateAndNotify = (updated: ScoringRule) => {
    prevRuleRef.current = updated;
    setRule(updated);
    onRuleChange(updated);
  };

  const addDimension = () => {
    const currentDimensions = rule.dimensions || [];
    const remainingWeight = Math.max(0, 100 - currentDimensions.reduce((s, d) => s + (d.weight || 0), 0));
    const newDimension: ScoringDimension = {
      id: `${rule.id}-dim-${generateId()}`,
      name: "新维度",
      weight: remainingWeight,
      description: "",
      type: "custom",
      evaluator: { method: "ai", aiPrompt: "" },
    };
    updateAndNotify({
      ...rule,
      dimensions: [...currentDimensions, newDimension],
      updatedAt: new Date(),
    });
  };

  const updateDimension = (index: number, updates: Partial<ScoringDimension>) => {
    const newDimensions = [...(rule.dimensions || [])];
    newDimensions[index] = { ...newDimensions[index], ...updates };
    updateAndNotify({ ...rule, dimensions: newDimensions, updatedAt: new Date() });
  };

  const removeDimension = (index: number) => {
    const newDimensions = (rule.dimensions || []).filter((_, i) => i !== index);
    updateAndNotify({ ...rule, dimensions: newDimensions, updatedAt: new Date() });
  };

  const dimensions = rule.dimensions || [];

  return (
    <div className="space-y-5">
      {/* AI Generation — hero area */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI 智能拆解评估维度</p>
            <p className="text-[11px] text-muted-foreground">用自然语言描述你的评估偏好，AI 自动拆解为结构化维度</p>
          </div>
        </div>
        <Textarea
          placeholder={'例如：\n• "必须有Go和K8s经验，项目经验要有大规模分布式系统"\n• "重视学历和算法功底，项目经验次之"\n• "3年以上后端经验，有微服务架构实战"'}
          value={naturalLanguageCriteria}
          onChange={(e) => setNaturalLanguageCriteria(e.target.value)}
          rows={3}
          className="bg-background/60 border-border/50 text-sm resize-none"
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateRule}
            disabled={!onGenerate || isGenerating || !naturalLanguageCriteria.trim()}
            size="sm"
            className="gradient-primary text-white"
          >
            {isGenerating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />拆解中...</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-1.5" />AI 智能拆解</>
            )}
          </Button>
          {validationError && (
            <span className="text-xs text-destructive">{validationError}</span>
          )}
        </div>
        {generationExplanation && (
          <div className="rounded-lg bg-muted/50 border border-border/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">设计思路：</span> {generationExplanation}
          </div>
        )}
      </div>

      {/* Dimensions header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">评估维度</h4>
          {dimensions.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {dimensions.length} 个维度
            </Badge>
          )}
        </div>
        <Button onClick={addDimension} size="sm" variant="outline" className="h-7 text-xs px-2">
          <Plus className="w-3 h-3 mr-1" />手动添加
        </Button>
      </div>

      {/* Dimension list */}
      {dimensions.length === 0 ? (
        <div className="text-center py-10 rounded-xl border border-dashed border-border/50 bg-muted/20">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无评估维度</p>
          <p className="text-xs text-muted-foreground mt-1">在上方输入评估偏好，AI 自动拆解</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dimensions.map((dimension, index) => (
            <DimensionItem
              key={dimension.id}
              dimension={dimension}
              index={index}
              job={job}
              onUpdate={(updates) => updateDimension(index, updates)}
              onRemove={() => removeDimension(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DimensionItemProps {
  dimension: ScoringDimension;
  index: number;
  job?: Job;
  onUpdate: (updates: Partial<ScoringDimension>) => void;
  onRemove: () => void;
}

function DimensionItem({ dimension, index, job, onUpdate, onRemove }: DimensionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const { evaluator } = dimension;

  const TYPE_LABELS: Record<string, string> = {
    skills: "技能", experience: "经验", education: "教育", projects: "项目", custom: "自定义",
  };

  const handleTypeChange = (type: ScoringDimension["type"]) => {
    let newEvaluator = { ...evaluator };
    switch (type) {
      case "skills":
        newEvaluator = { method: "keyword", keywords: job?.skills || [], matchMode: "any" };
        break;
      case "experience":
        newEvaluator = { method: "duration", minYears: 2, preferredYears: 5 };
        break;
      case "education":
        newEvaluator = { method: "ai", aiPrompt: "评估教育背景、学历层次和专业与岗位的相关性" };
        break;
      case "projects":
        newEvaluator = { method: "ai", aiPrompt: "评估项目经验的相关性、技术深度和候选人的贡献度" };
        break;
      default:
        newEvaluator = { method: "ai", aiPrompt: "" };
    }
    onUpdate({ type, evaluator: newEvaluator });
  };

  const handleMethodChange = (method: ScoringDimension["evaluator"]["method"]) => {
    let newEvaluator: ScoringDimension["evaluator"] = { method };
    switch (method) {
      case "keyword":
        newEvaluator = { method, keywords: evaluator.keywords || [], matchMode: evaluator.matchMode || "any" };
        break;
      case "duration":
        newEvaluator = { method, minYears: evaluator.minYears || 2, preferredYears: evaluator.preferredYears || 5 };
        break;
      case "ai":
        newEvaluator = { method, aiPrompt: evaluator.aiPrompt || "" };
        break;
      case "boolean":
        newEvaluator = { method, booleanField: evaluator.booleanField || "experience" };
        break;
      case "range":
        newEvaluator = { method, minValue: evaluator.minValue || 0, maxValue: evaluator.maxValue || 100 };
        break;
    }
    onUpdate({ evaluator: newEvaluator });
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden transition-all duration-200 hover:border-border/60 group">
      {/* Main row — clean list view */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <Input
              autoFocus
              value={dimension.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              className="h-7 text-sm font-medium"
            />
          ) : (
            <div
              className="text-sm font-medium cursor-text hover:text-primary transition-colors"
              onClick={() => setEditingName(true)}
            >
              {dimension.name}
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-2">
                {TYPE_LABELS[dimension.type] || dimension.type}
              </Badge>
            </div>
          )}

          {editingDesc ? (
            <Input
              autoFocus
              value={dimension.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              onBlur={() => setEditingDesc(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingDesc(false)}
              placeholder="添加描述..."
              className="h-6 text-[11px] text-muted-foreground mt-1 border-0 bg-transparent px-0 focus-visible:ring-0"
            />
          ) : (
            <p
              className="text-[11px] text-muted-foreground mt-0.5 cursor-text hover:text-foreground/60 transition-colors"
              onClick={() => setEditingDesc(true)}
            >
              {dimension.description || "点击添加描述..."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            title="高级配置"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="删除维度"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Advanced config — expandable */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/20 space-y-3 bg-muted/5">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">维度类型</Label>
              <Select value={dimension.type} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skills">技能</SelectItem>
                  <SelectItem value="experience">经验</SelectItem>
                  <SelectItem value="education">教育</SelectItem>
                  <SelectItem value="projects">项目</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">权重 (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={dimension.weight}
                onChange={(e) => onUpdate({ weight: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">评估方法</Label>
              <Select value={evaluator.method} onValueChange={handleMethodChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">关键词匹配</SelectItem>
                  <SelectItem value="duration">工作年限</SelectItem>
                  <SelectItem value="ai">AI评估</SelectItem>
                  <SelectItem value="boolean">布尔判断</SelectItem>
                  <SelectItem value="range">数值范围</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {evaluator.method === "keyword" && (
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">关键词（逗号分隔）</Label>
              <Input
                value={evaluator.keywords?.join(", ") || ""}
                onChange={(e) => {
                  const keywords = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                  onUpdate({ evaluator: { ...evaluator, keywords } });
                }}
                placeholder="Go, Docker, K8s"
                className="h-8 text-xs"
              />
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground shrink-0">匹配模式</Label>
                <Select
                  value={evaluator.matchMode || "any"}
                  onValueChange={(matchMode: "any" | "all") =>
                    onUpdate({ evaluator: { ...evaluator, matchMode } })
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">任意匹配</SelectItem>
                    <SelectItem value="all">全部匹配</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {evaluator.method === "duration" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">最低年限</Label>
                <Input
                  type="number" min={0}
                  value={evaluator.minYears || 0}
                  onChange={(e) => onUpdate({ evaluator: { ...evaluator, minYears: parseInt(e.target.value) || 0 } })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">理想年限</Label>
                <Input
                  type="number" min={0}
                  value={evaluator.preferredYears || evaluator.minYears || 0}
                  onChange={(e) => onUpdate({ evaluator: { ...evaluator, preferredYears: parseInt(e.target.value) || 0 } })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {evaluator.method === "ai" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">AI评估提示</Label>
              <Textarea
                value={evaluator.aiPrompt || ""}
                onChange={(e) => onUpdate({ evaluator: { ...evaluator, aiPrompt: e.target.value } })}
                placeholder="描述AI应该如何评估这个维度..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          )}

          {evaluator.method === "boolean" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">判断字段</Label>
              <Select
                value={evaluator.booleanField || "experience"}
                onValueChange={(booleanField) => onUpdate({ evaluator: { ...evaluator, booleanField } })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="education">教育经历</SelectItem>
                  <SelectItem value="projects">项目经验</SelectItem>
                  <SelectItem value="experience">工作经历</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {evaluator.method === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">最小值</Label>
                <Input
                  type="number"
                  value={evaluator.minValue || 0}
                  onChange={(e) => onUpdate({ evaluator: { ...evaluator, minValue: parseInt(e.target.value) || 0 } })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">最大值</Label>
                <Input
                  type="number"
                  value={evaluator.maxValue || 100}
                  onChange={(e) => onUpdate({ evaluator: { ...evaluator, maxValue: parseInt(e.target.value) || 100 } })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
