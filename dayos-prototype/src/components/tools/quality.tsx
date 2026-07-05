'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, RotateCcw, ImageIcon } from 'lucide-react';
import DropZone from '@/components/dropzone';
import { decreaseQuality, blobToPreview, getImageDimensions, formatFileSize } from '@/lib/image-utils';
import { downloadBlob } from '@/lib/storage';
import { getMimeTypeExt } from '@/lib/image-utils';
import { QualitySettings, ProcessedImage, DEFAULT_QUALITY_SETTINGS } from '@/lib/types';

interface QualityToolProps {
  settings?: QualitySettings;
  onSettingsChange?: (settings: QualitySettings) => void;
  locked?: boolean;
}

export default function QualityTool({
  settings: externalSettings,
  onSettingsChange,
  locked = false,
}: QualityToolProps) {
  const [settings, setSettings] = useState<QualitySettings>(
    externalSettings || DEFAULT_QUALITY_SETTINGS
  );
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultPreview, setResultPreview] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const isControlled = externalSettings !== undefined;

  const updateSettings = useCallback(
    (patch: Partial<QualitySettings>) => {
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

  const handleProcess = useCallback(async () => {
    if (!image) return;
    setProcessing(true);
    try {
      const blob = await decreaseQuality(image.file, settings);
      setResult(blob);
      const preview = URL.createObjectURL(blob);
      setResultPreview(preview);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }, [image, settings]);

  const handleDownload = useCallback(() => {
    if (!result || !image) return;
    const ext = getMimeTypeExt(result.type);
    const baseName = image.originalName.replace(/\.[^.]+$/, '');
    downloadBlob(result, `${baseName}_compressed.${ext}`);
  }, [result, image]);

  const handleReset = useCallback(() => {
    setImage(null);
    setResult(null);
    setResultPreview('');
    setDimensions(null);
  }, []);

  const compressionRatio = image && result
    ? ((1 - result.size / image.file.size) * 100).toFixed(0)
    : null;

  return (
    <div className="space-y-4">
      {/* Settings */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Quality Settings</h3>
            {locked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
          </div>

          {/* Quality Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Output Quality</Label>
              <span className="text-xs font-mono text-muted-foreground">{settings.quality}%</span>
            </div>
            <Slider
              value={[settings.quality]}
              onValueChange={([v]) => updateSettings({ quality: v })}
              min={1}
              max={100}
              step={1}
              disabled={locked}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Smallest file</span>
              <span>Best quality</span>
            </div>
          </div>

          {/* Output Format */}
          <div className="space-y-2">
            <Label className="text-xs">Output Format</Label>
            <Select
              value={settings.outputFormat}
              onValueChange={v => updateSettings({ outputFormat: v as 'jpeg' | 'webp' | 'png' })}
              disabled={locked}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG (.jpg)</SelectItem>
                <SelectItem value="webp">WebP (.webp)</SelectItem>
                <SelectItem value="png">PNG (.png)</SelectItem>
              </SelectContent>
            </Select>
            {settings.outputFormat === 'png' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                PNG is lossless — quality slider has no effect. Use JPEG or WebP for compression.
              </p>
            )}
          </div>

          {/* Max Dimension */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Max Dimension (px)</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.maxDimension || 'Original'}
              </span>
            </div>
            <Slider
              value={[settings.maxDimension || 4000]}
              onValueChange={([v]) => updateSettings({ maxDimension: v >= 3999 ? undefined : v })}
              min={100}
              max={4000}
              step={50}
              disabled={locked}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>100px</span>
              <span>Original size</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      {!image && (
        <DropZone
          onFiles={handleFiles}
          label="Drop an image to compress"
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

            <div className="relative rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center max-h-64">
              <img
                src={resultPreview || image.preview}
                alt="Preview"
                className="max-w-full max-h-64 object-contain"
              />
            </div>

            {result && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatFileSize(result.size)}</span>
                {compressionRatio && (
                  <Badge
                    variant={parseInt(compressionRatio) > 0 ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {parseInt(compressionRatio) > 0 ? `${compressionRatio}% smaller` : `${Math.abs(parseInt(compressionRatio))}% larger`}
                  </Badge>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={processing || !image}
                className="flex-1"
                size="sm"
              >
                {processing ? 'Processing...' : 'Compress Image'}
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