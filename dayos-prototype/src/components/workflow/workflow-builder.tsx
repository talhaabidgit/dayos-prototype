'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  GripVertical,
  Plus,
  Trash2,
  Play,
  Download,
  FolderOpen,
  X,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoveHorizontal,
  Zap,
  FileDown,
  Sparkles,
} from 'lucide-react';
import DropZone from '@/components/dropzone';
import { resizeImage, decreaseQuality, enhanceImage, canvasToBlob, getMimeTypeExt, formatFileSize } from '@/lib/image-utils';
import { saveToDirectory, downloadBlob, isFileSystemAccessSupported } from '@/lib/storage';
import {
  WorkflowStep,
  WorkflowConfig,
  ProcessedImage,
  ResizeSettings,
  QualitySettings,
  EnhanceSettings,
  DEFAULT_RESIZE_SETTINGS,
  DEFAULT_QUALITY_SETTINGS,
  DEFAULT_ENHANCE_SETTINGS,
  SIZE_TEMPLATES,
  ToolType,
} from '@/lib/types';

const TOOL_META: Record<ToolType, { label: string; icon: React.ElementType; color: string }> = {
  resize: { label: 'Resize', icon: MoveHorizontal, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  quality: { label: 'Quality', icon: FileDown, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  enhance: { label: 'Enhance', icon: Sparkles, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
};

export default function WorkflowBuilder() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'webp' | 'png'>('png');
  const [outputQuality, setOutputQuality] = useState(92);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const addStep = useCallback((toolType: ToolType) => {
    const id = crypto.randomUUID();
    let settings: ResizeSettings | QualitySettings | EnhanceSettings;
    switch (toolType) {
      case 'resize': settings = { ...DEFAULT_RESIZE_SETTINGS }; break;
      case 'quality': settings = { ...DEFAULT_QUALITY_SETTINGS }; break;
      case 'enhance': settings = { ...DEFAULT_ENHANCE_SETTINGS }; break;
    }
    setSteps(prev => [...prev, { id, toolType, settings, enabled: true }]);
    setAddDialogOpen(false);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const moveStep = useCallback((from: number, to: number) => {
    setSteps(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  }, []);

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      moveStep(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }, [moveStep]);

  const toggleEnabled = useCallback((id: string) => {
    setSteps(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  const updateStepSettings = useCallback((id: string, settings: ResizeSettings | QualitySettings | EnhanceSettings) => {
    setSteps(prev =>
      prev.map(s => (s.id === id ? { ...s, settings } : s))
    );
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const newImages: ProcessedImage[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      originalName: file.name,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      if (img?.resultPreview) URL.revokeObjectURL(img.resultPreview);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const clearImages = useCallback(() => {
    images.forEach(img => {
      URL.revokeObjectURL(img.preview);
      if (img.resultPreview) URL.revokeObjectURL(img.resultPreview);
    });
    setImages([]);
    setProgress(0);
  }, [images]);

  const processWorkflow = useCallback(async () => {
    const enabledSteps = steps.filter(s => s.enabled);
    if (enabledSteps.length === 0 || images.length === 0) return;

    setProcessing(true);
    const total = images.length;
    const results: { blob: Blob; name: string }[] = [];

    for (let i = 0; i < images.length; i++) {
      setCurrentImage(i);
      const img = images[i];
      setImages(prev =>
        prev.map(im =>
          im.id === img.id ? { ...im, status: 'processing' } : im
        )
      );

      try {
        let currentBlob: Blob = img.file;

        for (let j = 0; j < enabledSteps.length; j++) {
          setCurrentStep(j);
          const step = enabledSteps[j];

          switch (step.toolType) {
            case 'resize':
              currentBlob = await resizeImage(currentBlob, step.settings as ResizeSettings);
              break;
            case 'quality':
              currentBlob = await decreaseQuality(currentBlob, step.settings as QualitySettings);
              break;
            case 'enhance':
              currentBlob = await enhanceImage(currentBlob, step.settings as EnhanceSettings);
              break;
          }

          // Convert to desired output format
          if (j === enabledSteps.length - 1 && outputFormat !== 'png') {
            const tempImg = new Image();
            const url = URL.createObjectURL(currentBlob);
            await new Promise<void>((resolve, reject) => {
              tempImg.onload = () => resolve();
              tempImg.onerror = () => reject(new Error('load failed'));
              tempImg.src = url;
            });
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.width;
            canvas.height = tempImg.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(tempImg, 0, 0);
            const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
            currentBlob = await canvasToBlob(canvas, mimeType, outputQuality / 100);
            URL.revokeObjectURL(url);
          }
        }

        const ext = getMimeTypeExt(currentBlob.type);
        const baseName = img.originalName.replace(/\.[^.]+$/, '');
        const resultPreview = URL.createObjectURL(currentBlob);
        results.push({ blob: currentBlob, name: `${baseName}_processed.${ext}` });

        setImages(prev =>
          prev.map(im =>
            im.id === img.id
              ? { ...im, status: 'done', result: currentBlob, resultPreview }
              : im
          )
        );
      } catch (err) {
        console.error(`Error processing ${img.originalName}:`, err);
        setImages(prev =>
          prev.map(im =>
            im.id === img.id
              ? { ...im, status: 'error', errorMessage: (err as Error).message }
              : im
          )
        );
      }

      setProgress(Math.round(((i + 1) / total) * 100));

      // Yield to UI
      await new Promise(r => setTimeout(r, 50));
    }

    // Save results
    if (results.length > 0) {
      try {
        if (isFileSystemAccessSupported()) {
          await saveToDirectory(results);
        } else {
          results.forEach(({ blob, name }) => downloadBlob(blob, name));
        }
      } catch {
        // Fallback to individual downloads
        results.forEach(({ blob, name }) => downloadBlob(blob, name));
      }
    }

    setProcessing(false);
    setCurrentStep(0);
    setCurrentImage(0);
  }, [steps, images, outputFormat, outputQuality]);

  const handleDownloadResults = useCallback(() => {
    const done = images.filter(i => i.status === 'done' && i.result);
    const results = done.map(img => {
      const ext = getMimeTypeExt(img.result!.type);
      const baseName = img.originalName.replace(/\.[^.]+$/, '');
      return { blob: img.result!, name: `${baseName}_processed.${ext}` };
    });
    if (results.length > 0) {
      saveToDirectory(results).catch(() => {
        results.forEach(({ blob, name }) => downloadBlob(blob, name));
      });
    }
  }, [images]);

  const doneCount = images.filter(i => i.status === 'done').length;
  const errorCount = images.filter(i => i.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Workflow Steps */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Workflow Pipeline</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Add tools, configure settings, then drop images to process in sequence
              </p>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" disabled={processing}>
                  <Plus className="h-4 w-4" />
                  Add Tool
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                  <DialogTitle>Add Tool to Pipeline</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 mt-2">
                  {(Object.entries(TOOL_META) as [ToolType, typeof TOOL_META[ToolType]][]).map(
                    ([type, meta]) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="justify-start gap-3 h-12"
                        onClick={() => addStep(type)}
                      >
                        <div className={`rounded-md p-2 ${meta.color}`}>
                          <meta.icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{meta.label}</span>
                      </Button>
                    )
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No tools in pipeline yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click &quot;Add Tool&quot; to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => {
                const meta = TOOL_META[step.toolType];
                const Icon = meta.icon;
                const isExpanded = expandedStep === step.id;
                const isCurrentStep = processing && steps.filter(s => s.enabled).indexOf(step) === currentStep;

                return (
                  <div key={step.id}>
                    <div
                      className={`flex items-center gap-2 rounded-lg border p-3 transition-colors
                        ${isCurrentStep ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
                        ${!step.enabled ? 'opacity-50' : ''}`}
                      draggable={!processing}
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

                      {/* Step number */}
                      <div className={`rounded-md p-1.5 ${meta.color} shrink-0`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Step {index + 1}: {meta.label}
                          </span>
                          {isCurrentStep && (
                            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {getStepDescription(step)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                          disabled={processing}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${!step.enabled ? 'text-amber-500' : ''}`}
                          onClick={() => toggleEnabled(step.id)}
                          disabled={processing}
                        >
                          {step.enabled ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeStep(step.id)}
                          disabled={processing}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Settings */}
                    {isExpanded && (
                      <Card className="mt-2 ml-6 border-dashed">
                        <CardContent className="p-4 space-y-3">
                          <StepSettings
                            step={step}
                            onUpdate={s => updateStepSettings(step.id, s)}
                            locked={processing}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Connector arrow */}
                    {index < steps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-px h-4 bg-border relative">
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 border-b border-r border-border rotate-45" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Output Settings */}
      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Output Settings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Output Format</Label>
                <Select value={outputFormat} onValueChange={v => setOutputFormat(v as 'jpeg' | 'webp' | 'png')} disabled={processing}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (.png)</SelectItem>
                    <SelectItem value="jpeg">JPEG (.jpg)</SelectItem>
                    <SelectItem value="webp">WebP (.webp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {outputFormat !== 'png' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Output Quality</Label>
                    <span className="text-xs font-mono text-muted-foreground">{outputQuality}%</span>
                  </div>
                  <Slider
                    value={[outputQuality]}
                    onValueChange={([v]) => setOutputQuality(v)}
                    min={1}
                    max={100}
                    step={1}
                    disabled={processing}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Drop Zone */}
      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Images</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {images.length > 0
                    ? `${images.length} images selected`
                    : 'Drop images to process through the pipeline'}
                </p>
              </div>
              {images.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearImages}
                  disabled={processing}
                  className="text-destructive hover:text-destructive"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <DropZone
              onFiles={handleFiles}
              multiple
              disabled={processing}
              label="Drop images here"
              sublabel="or click to browse (multiple files supported)"
            />

            {/* Image list */}
            {images.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`flex items-center gap-3 rounded-lg border p-2 transition-colors
                      ${img.status === 'processing' ? 'border-primary bg-primary/5' : ''}
                      ${img.status === 'done' ? 'border-emerald-500/30 bg-emerald-500/5' : ''}
                      ${img.status === 'error' ? 'border-destructive/30 bg-destructive/5' : ''}
                    `}
                  >
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                      <img
                        src={img.resultPreview || img.preview}
                        alt={img.originalName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{img.originalName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(img.file.size)}
                        {img.result && ` → ${formatFileSize(img.result.size)}`}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {img.status === 'pending' && (
                        <Badge variant="outline" className="text-[10px]">Pending</Badge>
                      )}
                      {img.status === 'processing' && (
                        <Badge className="text-[10px] bg-primary">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Step {currentStep + 1}
                        </Badge>
                      )}
                      {img.status === 'done' && (
                        <Badge className="text-[10px] bg-emerald-600">Done</Badge>
                      )}
                      {img.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px]">Error</Badge>
                      )}
                    </div>
                    {!processing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeImage(img.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Progress */}
            {processing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Processing image {currentImage + 1} of {images.length}
                  {steps.filter(s => s.enabled).length > 0 && ` — Step ${currentStep + 1} of ${steps.filter(s => s.enabled).length}`}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {images.length > 0 && steps.filter(s => s.enabled).length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={processWorkflow}
                  disabled={processing || images.length === 0}
                  className="flex-1 gap-2"
                  size="sm"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Workflow ({images.length} images)
                    </>
                  )}
                </Button>
                {doneCount > 0 && !processing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadResults}
                    className="gap-1.5"
                  >
                    {isFileSystemAccessSupported() ? (
                      <FolderOpen className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Save All ({doneCount})
                  </Button>
                )}
              </div>
            )}

            {doneCount > 0 && errorCount > 0 && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                {doneCount} succeeded, {errorCount} failed
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getStepDescription(step: WorkflowStep): string {
  switch (step.toolType) {
    case 'resize': {
      const s = step.settings as ResizeSettings;
      if (s.mode === 'template') {
        const tmpl = SIZE_TEMPLATES.find(t => t.name === s.templateId);
        return tmpl ? `${tmpl.name} (${tmpl.width}×${tmpl.height}) — ${s.fitMode}` : 'Template';
      }
      return `${s.customWidth}×${s.customHeight} — ${s.fitMode}${s.maintainAspectRatio ? ' (ratio locked)' : ''}`;
    }
    case 'quality': {
      const s = step.settings as QualitySettings;
      return `${s.outputFormat.toUpperCase()} @ ${s.quality}%${s.maxDimension ? ` — max ${s.maxDimension}px` : ''}`;
    }
    case 'enhance': {
      const s = step.settings as EnhanceSettings;
      const parts: string[] = [];
      if (s.brightness !== 0) parts.push(`brightness ${s.brightness > 0 ? '+' : ''}${s.brightness}`);
      if (s.contrast !== 0) parts.push(`contrast ${s.contrast > 0 ? '+' : ''}${s.contrast}`);
      if (s.saturation !== 0) parts.push(`saturation ${s.saturation > 0 ? '+' : ''}${s.saturation}`);
      if (s.sharpness !== 0) parts.push(`sharpness ${s.sharpness}`);
      return parts.length > 0 ? parts.join(', ') : 'No changes';
    }
  }
}

function StepSettings({
  step,
  onUpdate,
  locked,
}: {
  step: WorkflowStep;
  onUpdate: (settings: ResizeSettings | QualitySettings | EnhanceSettings) => void;
  locked: boolean;
}) {
  const categories = [...new Set(SIZE_TEMPLATES.map(t => t.category))];

  if (step.toolType === 'resize') {
    const s = step.settings as ResizeSettings;
    const currentTemplate = SIZE_TEMPLATES.find(t => t.name === s.templateId);

    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant={s.mode === 'template' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ ...s, mode: 'template' })}
            disabled={locked}
            className="flex-1"
          >
            Templates
          </Button>
          <Button
            variant={s.mode === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onUpdate({ ...s, mode: 'custom' })}
            disabled={locked}
            className="flex-1"
          >
            Custom Size
          </Button>
        </div>

        {s.mode === 'template' ? (
          <div className="space-y-2">
            <Select
              value={currentTemplate?.category || categories[0]}
              onValueChange={cat => {
                const first = SIZE_TEMPLATES.find(t => t.category === cat);
                if (first) onUpdate({ ...s, templateId: first.name });
              }}
              disabled={locked}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={s.templateId || ''}
              onValueChange={v => onUpdate({ ...s, templateId: v })}
              disabled={locked}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_TEMPLATES.filter(
                  t => t.category === (currentTemplate?.category || categories[0])
                ).map(t => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} ({t.width}×{t.height})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={s.customWidth}
                  onChange={e => onUpdate({ ...s, customWidth: parseInt(e.target.value) || 1 })}
                  disabled={locked}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={s.customHeight}
                  onChange={e => onUpdate({ ...s, customHeight: parseInt(e.target.value) || 1 })}
                  disabled={locked}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`ratio-${step.id}`}
                checked={s.maintainAspectRatio}
                onCheckedChange={v => onUpdate({ ...s, maintainAspectRatio: v === true })}
                disabled={locked}
              />
              <Label htmlFor={`ratio-${step.id}`} className="text-xs cursor-pointer">
                Maintain aspect ratio
              </Label>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Fit Mode</Label>
          <div className="flex gap-2">
            {(['cover', 'contain', 'stretch'] as const).map(mode => (
              <Button
                key={mode}
                variant={s.fitMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ ...s, fitMode: mode })}
                disabled={locked}
                className="flex-1 text-xs capitalize"
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step.toolType === 'quality') {
    const s = step.settings as QualitySettings;
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Quality</Label>
            <span className="text-xs font-mono text-muted-foreground">{s.quality}%</span>
          </div>
          <Slider
            value={[s.quality]}
            onValueChange={([v]) => onUpdate({ ...s, quality: v })}
            min={1}
            max={100}
            disabled={locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Format</Label>
          <Select
            value={s.outputFormat}
            onValueChange={v => onUpdate({ ...s, outputFormat: v as 'jpeg' | 'webp' | 'png' })}
            disabled={locked}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Max Dimension</Label>
            <span className="text-xs font-mono text-muted-foreground">
              {s.maxDimension || 'Original'}
            </span>
          </div>
          <Slider
            value={[s.maxDimension || 4000]}
            onValueChange={([v]) => onUpdate({ ...s, maxDimension: v >= 3999 ? undefined : v })}
            min={100}
            max={4000}
            step={50}
            disabled={locked}
          />
        </div>
      </div>
    );
  }

  if (step.toolType === 'enhance') {
    const s = step.settings as EnhanceSettings;
    const controls = [
      { key: 'brightness' as const, label: 'Brightness', min: -100, max: 100 },
      { key: 'contrast' as const, label: 'Contrast', min: -100, max: 100 },
      { key: 'saturation' as const, label: 'Saturation', min: -100, max: 100 },
      { key: 'sharpness' as const, label: 'Sharpness', min: 0, max: 100 },
    ];
    return (
      <div className="space-y-3">
        {controls.map(c => (
          <div key={c.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{c.label}</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {s[c.key] > 0 ? '+' : ''}{s[c.key]}
              </span>
            </div>
            <Slider
              value={[s[c.key]]}
              onValueChange={([v]) => onUpdate({ ...s, [c.key]: v })}
              min={c.min}
              max={c.max}
              disabled={locked}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}