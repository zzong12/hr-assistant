"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Target, Plus, Search, Trash2, Edit, Briefcase,
  Loader2, Save, ArrowLeft, Layers, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { ScoringRuleEditor } from "@/components/ScoringRuleEditor";
import type { ScoringRule, Job } from "@/lib/types";

export default function ScoringRulesPage() {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<ScoringRule | null>(null);
  const [linkedJobs, setLinkedJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/scoring-rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      toast.error("加载评分参考失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const fetchRuleDetail = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/scoring-rules?id=${ruleId}`);
      const data = await res.json();
      if (data.rule) {
        setSelectedRule(data.rule);
        setLinkedJobs(data.linkedJobs || []);
      }
    } catch {
      toast.error("加载详情失败");
    }
  };

  const handleSelectRule = (rule: ScoringRule) => {
    setSelectedRule(rule);
    setIsEditing(false);
    setEditingRule(null);
    fetchRuleDetail(rule.id);
  };

  const handleCreate = async () => {
    if (!newRuleName.trim()) {
      toast.error("请输入名称");
      return;
    }
    try {
      const res = await fetch("/api/scoring-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRuleName.trim(),
          description: "",
          dimensions: [],
          totalScore: 100,
        }),
      });
      if (!res.ok) throw new Error("创建失败");
      const rule = await res.json();
      toast.success("评分参考创建成功");
      setIsCreateOpen(false);
      setNewRuleName("");
      await fetchRules();
      setSelectedRule(rule);
      setIsEditing(true);
      setEditingRule(rule);
      setLinkedJobs([]);
    } catch {
      toast.error("创建失败");
    }
  };

  const handleSave = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      const res = await fetch("/api/scoring-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRule),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存失败");
      }
      const updated = await res.json();
      toast.success("评分参考保存成功");
      setSelectedRule(updated);
      setIsEditing(false);
      setEditingRule(null);
      await fetchRules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRule) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scoring-rules?id=${selectedRule.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "删除失败");
      }
      toast.success("评分参考已删除");
      setSelectedRule(null);
      setIsEditing(false);
      setEditingRule(null);
      setIsDeleteOpen(false);
      await fetchRules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerate = async (criteria: string): Promise<ScoringRule & { explanation?: string }> => {
    const payload: any = { naturalLanguageCriteria: criteria, jobTitle: editingRule?.name || "通用" };
    const res = await fetch("/api/jobs/scoring-rule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("AI 生成失败");
    const data = await res.json();
    return {
      ...data.rule,
      id: editingRule?.id || data.rule.id,
      name: editingRule?.name || data.rule.name,
      explanation: data.explanation,
    };
  };

  const filteredRules = rules.filter(r =>
    !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Left: Rule List */}
      <div className="w-80 border-r border-border/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold gradient-text flex items-center gap-2">
              <Target className="w-5 h-5" />
              评分参考
            </h2>
            <Button
              size="sm"
              className="gradient-primary text-white h-8"
              onClick={() => { setIsCreateOpen(true); setNewRuleName(""); }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />新建
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索评分参考..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>暂无评分参考</p>
                <p className="text-xs mt-1">点击"新建"创建第一条评分参考</p>
              </div>
            ) : (
              filteredRules.map((rule) => (
                <Card
                  key={rule.id}
                  className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedRule?.id === rule.id
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "hover:border-border/80"
                  }`}
                  onClick={() => handleSelectRule(rule)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{rule.name}</p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                      v{rule.version}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      <Layers className="w-2.5 h-2.5 mr-0.5" />
                      {rule.dimensions?.length || 0} 维度
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Rule Detail / Editor */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!selectedRule ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground">选择一个评分参考查看详情</p>
              <p className="text-xs text-muted-foreground/60 mt-1">或点击左上角"新建"创建评分参考</p>
            </div>
          </div>
        ) : isEditing && editingRule ? (
          /* Editing Mode */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setIsEditing(false); setEditingRule(null); }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h3 className="text-sm font-semibold">编辑评分参考</h3>
                  <p className="text-xs text-muted-foreground">{editingRule.name}</p>
                </div>
              </div>
              <Button
                size="sm"
                className="gradient-primary text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                保存
              </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">名称</Label>
                    <Input
                      value={editingRule.name}
                      onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                      placeholder="评分参考名称"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">版本</Label>
                    <Input
                      value={editingRule.version}
                      disabled
                      className="text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">描述</Label>
                  <Input
                    value={editingRule.description || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    placeholder="简短描述这套评分参考的核心理念"
                  />
                </div>
                <ScoringRuleEditor
                  initialRule={editingRule}
                  onRuleChange={(updated) => setEditingRule({ ...updated, id: editingRule.id })}
                  onGenerate={handleGenerate}
                  ruleName={editingRule.name}
                />
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* Detail View */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{selectedRule.name}</h3>
                  <Badge variant="outline" className="text-[10px]">v{selectedRule.version}</Badge>
                </div>
                {selectedRule.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedRule.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(true);
                    setEditingRule({ ...selectedRule });
                  }}
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />编辑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />删除
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl space-y-6">
                {/* Dimensions */}
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 rounded-full bg-primary" />
                    评估维度
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {selectedRule.dimensions?.length || 0} 个
                    </Badge>
                  </h4>
                  {(!selectedRule.dimensions || selectedRule.dimensions.length === 0) ? (
                    <div className="text-center py-8 rounded-xl border border-dashed border-border/50 bg-muted/20">
                      <Layers className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">暂无评估维度</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setIsEditing(true);
                          setEditingRule({ ...selectedRule });
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />添加维度
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedRule.dimensions.map((dim, i) => {
                        const methodLabels: Record<string, string> = {
                          keyword: "关键词",
                          duration: "年限",
                          ai: "AI",
                          boolean: "布尔",
                          range: "范围",
                        };
                        const typeLabels: Record<string, string> = {
                          skills: "技能",
                          experience: "经验",
                          education: "教育",
                          projects: "项目",
                          custom: "自定义",
                        };
                        return (
                          <Card key={dim.id} className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{dim.name}</span>
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                    {typeLabels[dim.type] || dim.type}
                                  </Badge>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                                    {methodLabels[dim.evaluator?.method] || "AI"}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                    权重 {dim.weight}%
                                  </span>
                                </div>
                                {dim.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{dim.description}</p>
                                )}
                                {dim.evaluator?.keywords && dim.evaluator.keywords.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {dim.evaluator.keywords.map((kw, ki) => (
                                      <Badge key={ki} variant="outline" className="text-[9px] h-4 px-1.5">
                                        {kw}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Linked Jobs */}
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 rounded-full bg-blue-500" />
                    关联岗位
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {linkedJobs.length} 个
                    </Badge>
                  </h4>
                  {linkedJobs.length === 0 ? (
                    <div className="text-center py-6 rounded-xl border border-dashed border-border/50 bg-muted/20">
                      <Link2 className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">暂无岗位关联此评分参考</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">在职位管理中选择此评分参考即可关联</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {linkedJobs.map((job) => (
                        <Card key={job.id} className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Briefcase className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{job.title}</p>
                            <p className="text-xs text-muted-foreground">{job.department}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 ${
                              job.status === "active" ? "text-green-600 border-green-300" : "text-muted-foreground"
                            }`}
                          >
                            {job.status === "active" ? "招聘中" : job.status === "draft" ? "草稿" : job.status === "paused" ? "暂停" : "已关闭"}
                          </Badge>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              新建评分参考
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="例如：高级后端工程师评分参考"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>取消</Button>
              <Button className="gradient-primary text-white" onClick={handleCreate}>
                创建并编辑
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="删除评分参考"
        description={`确定要删除"${selectedRule?.name}"吗？${linkedJobs.length > 0 ? `该评分参考正被 ${linkedJobs.length} 个岗位使用，需先解除关联。` : "此操作不可撤销。"}`}
        onConfirm={handleDelete}
        confirmLabel="删除"
        variant="destructive"
      />
    </div>
  );
}
