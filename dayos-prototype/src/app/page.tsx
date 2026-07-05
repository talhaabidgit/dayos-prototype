'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MoveHorizontal,
  FileDown,
  Sparkles,
  Workflow,
  Zap,
  MonitorSmartphone,
} from 'lucide-react';
import ResizerTool from '@/components/tools/resizer';
import QualityTool from '@/components/tools/quality';
import EnhancerTool from '@/components/tools/enhancer';
import WorkflowBuilder from '@/components/workflow/workflow-builder';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ImageKit</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">Offline Static Image Tools</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] gap-1 hidden sm:flex">
              <MonitorSmartphone className="h-3 w-3" />
              Works Offline
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              v1.0
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="workflow" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-6 h-auto p-1">
            <TabsTrigger value="workflow" className="gap-1.5 py-2.5 text-xs sm:text-sm">
              <Workflow className="h-4 w-4 hidden sm:block" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="resize" className="gap-1.5 py-2.5 text-xs sm:text-sm">
              <MoveHorizontal className="h-4 w-4 hidden sm:block" />
              Resize
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-1.5 py-2.5 text-xs sm:text-sm">
              <FileDown className="h-4 w-4 hidden sm:block" />
              Quality
            </TabsTrigger>
            <TabsTrigger value="enhance" className="gap-1.5 py-2.5 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4 hidden sm:block" />
              Enhance
            </TabsTrigger>
          </TabsList>

          {/* Workflow Tab */}
          <TabsContent value="workflow">
            <WorkflowBuilder />
          </TabsContent>

          {/* Individual Tools */}
          <TabsContent value="resize">
            <div className="max-w-xl mx-auto">
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MoveHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-sm font-semibold">Image Resizer</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Resize images to preset templates (Instagram, Facebook, YouTube, etc.) or custom dimensions.
                    Supports cover, contain, and stretch fit modes.
                  </p>
                </CardContent>
              </Card>
              <ResizerTool />
            </div>
          </TabsContent>

          <TabsContent value="quality">
            <div className="max-w-xl mx-auto">
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h2 className="text-sm font-semibold">Quality Decreaser</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reduce image file size by adjusting quality, format (JPEG, WebP, PNG),
                    and maximum dimensions. Great for web optimization.
                  </p>
                </CardContent>
              </Card>
              <QualityTool />
            </div>
          </TabsContent>

          <TabsContent value="enhance">
            <div className="max-w-xl mx-auto">
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h2 className="text-sm font-semibold">Image Enhancer</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enhance images with brightness, contrast, saturation, and sharpening controls.
                    See before/after comparison in real time.
                  </p>
                </CardContent>
              </Card>
              <EnhancerTool />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            ImageKit — All processing happens in your browser. No data is uploaded. Fully static &amp; offline-capable.
          </p>
        </div>
      </footer>
    </div>
  );
}