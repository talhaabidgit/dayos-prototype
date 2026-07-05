export interface SizeTemplate {
  name: string;
  width: number;
  height: number;
  category: string;
}

export interface ResizeSettings {
  mode: 'template' | 'custom';
  templateId: string | null;
  customWidth: number;
  customHeight: number;
  maintainAspectRatio: boolean;
  fitMode: 'cover' | 'contain' | 'stretch';
}

export interface QualitySettings {
  quality: number; // 0-100
  outputFormat: 'jpeg' | 'webp' | 'png';
  maxDimension?: number;
}

export interface EnhanceSettings {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  sharpness: number; // 0 to 100
}

export type ToolType = 'resize' | 'quality' | 'enhance';

export interface WorkflowStep {
  id: string;
  toolType: ToolType;
  settings: ResizeSettings | QualitySettings | EnhanceSettings;
  enabled: boolean;
}

export interface WorkflowConfig {
  steps: WorkflowStep[];
  outputFormat: 'jpeg' | 'webp' | 'png';
  outputQuality: number;
}

export interface ProcessedImage {
  id: string;
  file: File;
  originalName: string;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  result?: Blob;
  resultPreview?: string;
}

export const DEFAULT_RESIZE_SETTINGS: ResizeSettings = {
  mode: 'template',
  templateId: 'instagram-post',
  customWidth: 800,
  customHeight: 600,
  maintainAspectRatio: true,
  fitMode: 'cover',
};

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  quality: 70,
  outputFormat: 'jpeg',
};

export const DEFAULT_ENHANCE_SETTINGS: EnhanceSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
};

export const SIZE_TEMPLATES: SizeTemplate[] = [
  { name: 'Instagram Post', width: 1080, height: 1080, category: 'Instagram' },
  { name: 'Instagram Story', width: 1080, height: 1920, category: 'Instagram' },
  { name: 'Instagram Reel', width: 1080, height: 1920, category: 'Instagram' },
  { name: 'Instagram Landscape', width: 1080, height: 566, category: 'Instagram' },
  { name: 'Facebook Post', width: 1200, height: 630, category: 'Facebook' },
  { name: 'Facebook Cover', width: 820, height: 312, category: 'Facebook' },
  { name: 'Facebook Ad', width: 1200, height: 628, category: 'Facebook' },
  { name: 'YouTube Thumbnail', width: 1280, height: 720, category: 'YouTube' },
  { name: 'YouTube Channel Art', width: 2560, height: 1440, category: 'YouTube' },
  { name: 'YouTube Shorts', width: 1080, height: 1920, category: 'YouTube' },
  { name: 'Twitter/X Post', width: 1200, height: 675, category: 'Twitter/X' },
  { name: 'Twitter/X Header', width: 1500, height: 500, category: 'Twitter/X' },
  { name: 'LinkedIn Post', width: 1200, height: 627, category: 'LinkedIn' },
  { name: 'LinkedIn Banner', width: 1584, height: 396, category: 'LinkedIn' },
  { name: 'Pinterest Pin', width: 1000, height: 1500, category: 'Pinterest' },
  { name: 'Pinterest Story', width: 1080, height: 1920, category: 'Pinterest' },
  { name: 'TikTok Video', width: 1080, height: 1920, category: 'TikTok' },
  { name: 'Snapchat Story', width: 1080, height: 1920, category: 'Snapchat' },
  { name: 'A4 Print (300dpi)', width: 2480, height: 3508, category: 'Print' },
  { name: 'HD Wallpaper', width: 1920, height: 1080, category: 'Display' },
  { name: '4K Wallpaper', width: 3840, height: 2160, category: 'Display' },
  { name: 'Square (500px)', width: 500, height: 500, category: 'Common' },
  { name: 'Thumbnail (150px)', width: 150, height: 150, category: 'Common' },
];