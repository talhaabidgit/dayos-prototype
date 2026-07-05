'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Download, RotateCcw, ImageIcon } from 'lucide-react';
import DropZone from '@/components/dropzone';
import { enhanceImage, getImageDimensions, formatFileSize } from '@/lib/image-utils';
import { downloadBlob } from '@/lib/storage';
import { getMimeTypeExt } from '@/lib/image-utils';
import { EnhanceSettings, ProcessedImage, DEFAULT_ENHANCE_SETTINGS } from '@/lib/types';

interface EnhancerToolProps {
  settings?: EnhanceSettings;
  onSettingsChange?: (settings: EnhanceSettings) => void;
  locked?: boolean;
  outputFormat?: 'jpeg' | 'webp' | 'png';
  outputQuality?: number;
}

interface SliderControl {
  key: keyof EnhanceSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  unit: string;
}

const SLIDERS: SliderControl[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 1, defaultVal: 0, unit: '' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, defaultVal: 0, unit: '' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, defaultVal: 0, unit: '' },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, step: 1, defaultVal: 0, unit: '' },
];

export default function EnhancerTool({
  settings: externalSettings,
  onSettingsChange,
  locked = false,
  outputFormat = 'png',
  outputQuality = 95,
}: EnhancerToolProps) {
  const [settings, setSettings] = useState<EnhanceSettings>(
    externalSettings || DEFAULT_ENHANCE_SETTINGS
  );
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultPreview, setResultPreview] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const updateSettings = useCallback(
    (patch: Partial<EnhanceSettings>) => {
      setSettings(prev => {
        const next = { ...prev, ...patch };
        if (onSettingsChange) onSettingsChange(next);
        return next;
      });
    },
    [onSettingsChange]
  );

  React.useEffect(() => {
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

  const handleEnhance = useCallback(async () => {
    if (!image) return;
    setProcessing(true);
    try {
      let blob = await enhanceImage(image.file, settings);
      // Convert to desired output format if needed
      if (outputFormat !== 'png') {
        const img = new Image();
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
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error('toBlob failed'))),
            mimeType,
            outputQuality / 100
          );
        });
        URL.revokeObjectURL(url);
      }
      setResult(blob);
      const preview = URL.createObjectURL(blob);
      setResultPreview(preview);
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
    downloadBlob(result, `${baseName}_enhanced.${ext}`);
  }, [result, image]);

  const handleReset = useCallback(() => {
    setImage(null);
    setResult(null);
    setResultPreview('');
    setDimensions(null);
  }, []);

  const hasChanges = settings.brightness !== 0 || settings.contrast !== 0 ||
    settings.saturation !== 0 || settings.sharpness !== 0;

  return (
    <div className="space-y-4">
      {/* Settings */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Enhancement Settings</h3>
            <div className="flex items-center gap-2">
              {hasChanges && !locked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    const reset = { ...DEFAULT_ENHANCE_SETTINGS };
                    setSettings(reset);
                    if (onSettingsChange) onSettingsChange(reset);
                  }}
                >
                  Reset All
                </Button>
              )}
              {locked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
            </div>
          </div>

          {SLIDERS.map(s => (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{s.label}</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {(settings[s.key] as number) > 0 ? '+' : ''}{settings[s.key] as number}{s.unit}
                </span>
              </div>
              <Slider
                value={[settings[s.key] as number]}
                onValueChange={([v]) => updateSettings({ [s.key]: v })}
                min={s.min}
                max={s.max}
                step={s.step}
                disabled={locked}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Drop Zone */}
      {!image && (
        <DropZone
          onFiles={handleFiles}
          label="Drop an image to enhance"
          sublabel="Supports JPG, PNG, WebP"
        />
      )}

      {/* Preview */}
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

            {/* Before/After Preview */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Before</span>
                <div className="rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center h-32">
                  <img
                    src={image.preview}
                    alt="Original"
                    className="max-w-full max-h-32 object-contain"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">After</span>
                <div className="rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center h-32">
                  {resultPreview ? (
                    <img
                      src={resultPreview}
                      alt="Enhanced"
                      className="max-w-full max-h-32 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No result yet</span>
                  )}
                </div>
              </div>
            </div>

            {result && (
              <div className="text-xs text-muted-foreground text-right">
                {formatFileSize(result.size)}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleEnhance}
                disabled={processing || !image || !hasChanges}
                className="flex-1"
                size="sm"
              >
                {processing ? 'Processing...' : 'Enhance Image'}
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
    </div>
  );
}