import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, Eye, Sparkles, Loader2, Camera } from 'lucide-react';

export default function ImageUploadField({ label, imageUrl, onUpload, onExtract, extractFields }) {
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  const processFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUpload(file_url);
    setUploading(false);

    if (extractFields && onExtract) {
      setExtracting(true);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract the following fields from this document image: ${extractFields.join(', ')}. Return only the requested fields as a JSON object with these exact keys: ${extractFields.join(', ')}. If a field is not found, return an empty string for it.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: Object.fromEntries(extractFields.map(f => [f, { type: 'string' }]))
        }
      });
      onExtract(result);
      setExtracting(false);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);
  const handleCameraChange = (e) => processFile(e.target.files[0]);

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      {imageUrl ? (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
          <img
            src={imageUrl}
            alt={label}
            className="h-10 w-14 object-cover rounded"
            onError={e => e.target.style.display = 'none'}
          />
          <span className="text-xs text-muted-foreground flex-1 truncate">
            {extracting ? (
              <span className="flex items-center gap-1 text-primary">
                <Loader2 size={11} className="animate-spin" /> Extracting details…
              </span>
            ) : 'Uploaded'}
          </span>
          <a href={imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:opacity-75">
            <Eye size={15} />
          </a>
          <button type="button" onClick={() => onUpload('')} className="text-destructive hover:opacity-75">
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Upload from file */}
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-colors text-xs text-muted-foreground"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload'}
            {extractFields && !uploading && (
              <span className="text-primary flex items-center gap-0.5">
                <Sparkles size={10} />
              </span>
            )}
          </button>

          {/* Camera / scan */}
          <button
            type="button"
            onClick={() => cameraInputRef.current.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-colors text-xs text-muted-foreground"
            title="Take photo / scan"
          >
            <Camera size={14} />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>
      )}
    </div>
  );
}