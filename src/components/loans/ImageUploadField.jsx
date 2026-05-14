import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, Eye } from 'lucide-react';

export default function ImageUploadField({ label, imageUrl, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUpload(file_url);
    setUploading(false);
  };

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {imageUrl ? (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
          <img src={imageUrl} alt={label} className="h-10 w-14 object-cover rounded" />
          <span className="text-xs text-muted-foreground flex-1 truncate">Uploaded</span>
          <a href={imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:opacity-75">
            <Eye size={15} />
          </a>
          <button type="button" onClick={() => onUpload('')} className="text-destructive hover:opacity-75">
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-colors text-xs text-muted-foreground"
        >
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload Image'}
        </button>
      )}
    </div>
  );
}