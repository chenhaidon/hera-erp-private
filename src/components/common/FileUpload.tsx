import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Upload, X, FileImage, FileText } from 'lucide-react';

interface FileUploadProps {
  value?: string[];
  onChange: (urls: string[]) => void;
  bucket?: string;
  folder?: string;
  accept?: string;
  onPreview?: (url: string) => void;
}

function sanitizeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9.]/g, '_').replace(/_+/g, '_');
  const ext = base.split('.').pop() || 'bin';
  const stem = base.slice(0, base.lastIndexOf('.')) || 'file';
  return `${stem.slice(0, 40)}_${Date.now()}.${ext}`;
}

function compressImage(file: File, maxWidth = 1080, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建 canvas 上下文'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('压缩失败'))),
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

export function FileUpload({
  value = [],
  onChange,
  bucket = 'quality-reports',
  folder = 'inspections',
  accept = 'image/*,.pdf',
  onPreview,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading(true);
    setProgress(0);
    const urls = [...value];

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      let uploadFile = file;
      const isImage = file.type.startsWith('image/');
      const maxSize = 1024 * 1024;

      if (file.size > maxSize) {
        if (isImage) {
          try {
            const blob = await compressImage(file);
            uploadFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
            const finalSize = uploadFile.size;
            toast.info(`${file.name} 已压缩至 ${(finalSize / 1024 / 1024).toFixed(2)}MB`);
            if (finalSize > maxSize) {
              toast.error(`${file.name} 压缩后仍超过 1MB，请重新选择`);
              continue;
            }
          } catch (err) {
            toast.error(`${file.name} 压缩失败`);
            continue;
          }
        } else {
          toast.error(`${file.name} 超过 1MB，请拆分或压缩后上传`);
          continue;
        }
      }

      const path = `${folder}/${sanitizeFileName(uploadFile.name)}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, uploadFile, { contentType: uploadFile.type });

      if (error || !data) {
        toast.error(`${file.name} 上传失败: ${error?.message || '未知错误'}`);
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        urls.push(urlData.publicUrl);
        toast.success(`${file.name} 上传成功`);
      }
      setProgress(Math.round(((i + 1) / list.length) * 100));
    }

    setUploading(false);
    setProgress(0);
    onChange(urls);
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  function isImageUrl(url: string) {
    return /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div
            key={url}
            role={onPreview ? 'button' : undefined}
            tabIndex={onPreview ? 0 : undefined}
            onClick={onPreview ? () => onPreview(url) : undefined}
            onKeyDown={onPreview ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview(url); } } : undefined}
            className={`relative h-20 w-20 rounded-lg border bg-muted p-1 ${onPreview ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            {isImageUrl(url) ? (
              <img src={url} alt="附件" className="h-full w-full rounded object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-xs text-muted-foreground">
                <FileText className="h-6 w-6" />
                <span className="mt-1">PDF</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:opacity-90"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {uploading && <Progress value={progress} className="h-2" />}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1 h-4 w-4" />
          {uploading ? '上传中...' : '上传报告/图片'}
        </Button>
        <span className="text-xs text-muted-foreground">支持 JPG/PNG/WEBP/PDF，单张 ≤1MB</span>
      </div>
    </div>
  );
}
