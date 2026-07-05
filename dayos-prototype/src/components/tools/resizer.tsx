'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, RotateCcw, ImageIcon, Info } from 'lucide-react';
import DropZone from '@/components/dropzone';
import {
  resizeImage,
  blobToPreview,
  getImageDimensions,
  formatFileSize,
  canvasToBlob,
  getMimeTypeExt,
} from '@/lib/image-utils';
import { downloadBlob } from '@/lib/storage';
import {
  ResizeSettings,
  ProcessedImage,
  SIZE_TEMPLATES,
  DEFAULT_RESIZE_SETTINGS,
} from '@/lib/types';

interface ResizerToolProps {
  settings?: ResizeSettings;
  onSettingsChange?: (settings: ResizeSettings) => void;
  locked?: boolean;
  outputFormat?: 'jpeg' | 'webp' | 'png';
  outputQuality?: number;
}

export default function ResizerTool({
  settings: externalSettings,
  onSettingsChange,
  locked = false,
  outputFormat = 'png',
  outputQuality = 92,
}: ResizerToolProps) {
  const [settings, setSettings] = useState<ResizeSettings>(
    externalSettings || DEFAULT_RESIZE_SETTINGS
  );
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultPreview, setResultPreview] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isControlled = externalSettings !== undefined;

  const updateSettings = useCallback(
    (patch: Partial<ResizeSettings>) => {
      setSettings(prev => {
        const next = { ...prev, ...patch };
        if (onSettingsChange) onSettingsChange(next);
        return next;
      });
    },
    [onSettingsChange]
  );

  useEffect(() => {
    if (externalSettings) setSettings(externalSettings);
  }, [externalSettings]);

  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    try {
      const dims = await getImageDimensions(file);
      setDimensions(dims);
    } catch {
      // ignore
    }
    setImage({ id: crypto.randomUUID(), file, originalName: file.name, preview, status: 'pending' });
    setResult(null);
    setResultPreview('');
  }, []);

  const handleResize = useCallback(async () => {
    if (!image) return;
    setProcessing(true);
    try {
      const blob = await resizeImage(image.file, settings);
      // Convert to desired output format
      let finalBlob = blob;
      if (outputFormat !== 'png') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('load failed'));
          img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
        finalBlob = await canvasToBlob(canvas, mimeType, outputQuality / 100);
        URL.revokeObjectURL(url);
      }
      setResult(finalBlob);
      const preview = URL.createObjectURL(finalBlob);
      setResultPreview(preview);
      if (canvasRef.current) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = preview;
        });
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        const ctx = canvasRef.current.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }, [image, settings, outputFormat, outputQuality]);

  const handleDownload = useCallback(() => {
    if (!result || !image) return;
    const ext = getMimeTypeExt(result.type);
    const baseName = image.originalName.replace(/\.[^.]+$/, '');
    downloadBlob(result, `${baseName}_resized.${ext}`);
  }, [result, image]);

  const handleReset = useCallback(() => {
    setImage(null);
    setResult(null);
    setResultPreview('');
    setDimensions(null);
  }, []);

  const currentTemplate = SIZE_TEMPLATES.find(
    t => t.name === settings.templateId
  );

  const categories = [...new Set(SIZE_TEMPLATES.map(t => t.category))];

  return (
    <div className="space-y-4">
      {/* Settings Panel */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Resize Settings</h3>
            {locked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={settings.mode === 'template' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSettings({ mode: 'template' })}
              disabled={locked}
              className="flex-1"
            >
              Templates
            </Button>
            <Button
              variant={settings.mode === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSettings({ mode: 'custom' })}
              disabled={locked}
              className="flex-1"
            >
              Custom Size
            </Button>
          </div>

          {settings.mode === 'template' ? (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select
                value={currentTemplate?.category || ''}
                onValueChange={cat => {
                  const first = SIZE_TEMPLATES.find(t => t.category === cat);
                  if (first) updateSettings({ templateId: first.name });
                }}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label className="text-xs text-muted-foreground">Template</Label>
              <Select
                value={settings.templateId || ''}
                onValueChange={v => updateSettings({ templateId: v })}
                disabled={locked}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
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

              {currentTemplate && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-xs text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" />
                  <span>Output: {currentTemplate.width} × {currentTemplate.height} px</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Width (px)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.customWidth}
                    onChange={e => updateSettings({ customWidth: parseInt(e.target.value) || 1 })}
                    disabled={locked}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height (px)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.customHeight}
                    onChange={e => updateSettings({ customHeight: parseInt(e.target.value) || 1 })}
                    disabled={locked}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="maintain-ratio"
                  checked={settings.maintainAspectRatio}
                  onCheckedChange={v => updateSettings({ maintainAspectRatio: v === true })}
                  disabled={locked}
                />
                <Label htmlFor="maintain-ratio" className="text-xs cursor-pointer">
                  Maintain aspect ratio
                </Label>
              </div>
            </div>
          )}

          {/* Fit Mode */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Fit Mode</Label>
            <div className="flex gap-2">
              {(['cover', 'contain', 'stretch'] as const).map(mode => (
                <Button
                  key={mode}
                  variant={settings.fitMode === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ fitMode: mode })}
                  disabled={locked}
                  className="flex-1 text-xs capitalize"
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      {!image && (
        <DropZone
          onFiles={handleFiles}
          label="Drop an image to resize"
          sublabel="Supports JPG, PNG, WebP"
        />
      )}

      {/* Image Preview & Actions */}
      {image && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{image.originalName}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {dimensions && (
                  <Badge variant="outline" className="text-xs">
                    {dimensions.width}×{dimensions.height}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {formatFileSize(image.file.size)}
                </Badge>
              </div>
            </div>

            <div className="relative rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center max-h-64">
              {resultPreview ? (
                <img
                  src={resultPreview}
                  alt="Resized result"
                  className="max-w-full max-h-64 object-contain"
                />
              ) : (
                <img
                  src={image.preview}
                  alt="Original"
                  className="max-w-full max-h-64 object-contain"
                />
              )}
            </div>

            {result && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Result: {result ? `${result.width ?? '?'}×${result.height ?? '?'}` : '—'}
                </span>
                <span>{formatFileSize(result.size)}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleResize}
                disabled={processing || !image}
                className="flex-1"
                size="sm"
              >
                {processing ? 'Processing...' : 'Resize Image'}
              </Button>
              {result && (
                <Button onClick={handleDownload} variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Save
                </Button>
              )}
              <Button onClick={handleReset} variant="ghost" size="icon" className="shrink-0">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}