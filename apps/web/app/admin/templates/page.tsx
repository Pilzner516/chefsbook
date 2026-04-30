'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@chefsbook/db';
import { useConfirmDialog } from '@/components/useConfirmDialog';

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  status: 'active' | 'inactive' | 'draft' | 'error';
  supported_page_sizes: string[];
  lulu_compliant: boolean;
  thumbnail_url: string | null;
  manifest: Record<string, unknown> | null;
  validation_errors: string[] | null;
  created_at: string;
  updated_at: string;
}

type PageSizeKey = 'letter' | 'trade' | 'large-trade' | 'digest' | 'square';

const PAGE_SIZE_LABELS: Record<PageSizeKey, string> = {
  'letter': '8.5×11',
  'trade': '6×9',
  'large-trade': '7×10',
  'digest': '5.5×8.5',
  'square': '8×8',
};

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    draft: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.inactive}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TemplateCard({
  template,
  onToggleStatus,
  onPreview,
  onDelete,
}: {
  template: Template;
  onToggleStatus: (t: Template) => void;
  onPreview: (t: Template) => void;
  onDelete: (t: Template) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="h-28 bg-cb-base flex items-center justify-center">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="w-20 h-28 object-cover"
          />
        ) : (
          <div className="w-20 h-28 bg-cb-border flex items-center justify-center">
            <svg className="w-8 h-8 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm text-cb-text truncate flex items-center gap-1.5">
            {template.name}
            {template.is_system && (
              <svg className="w-3.5 h-3.5 text-cb-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </h3>
          <StatusBadge status={template.status} />
        </div>

        <p className="text-xs text-cb-muted mb-2 line-clamp-2 h-8">
          {template.description || 'No description'}
        </p>

        {/* Page sizes */}
        <div className="flex flex-wrap gap-1 mb-2">
          {template.supported_page_sizes.map((size) => (
            <span
              key={size}
              className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]"
            >
              {PAGE_SIZE_LABELS[size as PageSizeKey] || size}
            </span>
          ))}
        </div>

        {/* Lulu compliance */}
        <div className="flex items-center gap-1 mb-3">
          {template.lulu_compliant ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[10px] text-green-700">Lulu compliant</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-[10px] text-amber-600">Not Lulu compliant</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
          <button
            onClick={() => onPreview(template)}
            className="text-xs text-cb-primary hover:underline"
          >
            Preview
          </button>
          <button
            onClick={() => onToggleStatus(template)}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            {template.status === 'active' ? 'Disable' : 'Enable'}
          </button>
          {!template.is_system && (
            <button
              onClick={() => onDelete(template)}
              className="text-xs text-red-600 hover:text-red-700 ml-auto"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const [pageSize, setPageSize] = useState<PageSizeKey>('letter');
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch(
        `/api/admin/templates/${template.id}/preview?pageSize=${pageSize}&format=pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to load preview');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  }, [template.id, pageSize]);

  useEffect(() => {
    loadPreview();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [loadPreview]);

  const pageSizes: PageSizeKey[] = ['letter', 'trade', 'large-trade', 'digest', 'square'];

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="font-semibold text-lg">{template.name}</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Page size tabs */}
      <div className="flex border-b border-gray-200">
        {pageSizes.map((size) => (
          <button
            key={size}
            onClick={() => setPageSize(size)}
            className={`flex-1 py-2 text-xs font-medium transition ${
              pageSize === size
                ? 'text-cb-primary border-b-2 border-cb-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {PAGE_SIZE_LABELS[size]}
          </button>
        ))}
      </div>

      {/* Preview content */}
      <div className="flex-1 bg-gray-100 p-4 overflow-auto">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-500">Loading preview...</div>
          </div>
        )}
        {error && (
          <div className="h-full flex items-center justify-center">
            <div className="text-red-600 text-center">
              <p className="font-medium">Preview failed</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
        {pdfUrl && !loading && !error && (
          <iframe
            src={pdfUrl}
            className="w-full h-full bg-white rounded shadow"
            title="Template Preview"
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

interface GeneratedTemplate {
  code: string;
  manifest: {
    id: string;
    name: string;
    description: string;
    version: string;
    isSystem: boolean;
    status: string;
    supportedPageSizes: string[];
    luluCompliant: boolean;
    fonts: Array<{ family: string; weights: number[]; italic?: number[] }>;
    settings: {
      palette: {
        accent: string;
        background: string;
        text: string;
        muted: string;
        surface: string;
      };
      fonts: { heading: string; body: string };
    };
  };
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  tokensUsed: number;
  remaining: number;
}

const STYLE_OPTIONS = ['minimal', 'bold', 'editorial', 'rustic', 'modern'] as const;

function UploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<'upload' | 'generate'>('upload');

  // Upload tab state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadedTemplate, setUploadedTemplate] = useState<Template | null>(null);

  // Generate tab state
  const [description, setDescription] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState('#ce2b37');
  const [backgroundColor, setBackgroundColor] = useState('#faf7f0');
  const [generating, setGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [rateLimit, setRateLimit] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Load rate limit on tab switch
  useEffect(() => {
    if (tab === 'generate') {
      loadRateLimit();
    }
  }, [tab]);

  const loadRateLimit = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch('/api/admin/templates/generate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimit(data);
      }
    } catch {
      // Ignore
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setValidationErrors([]);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        setValidationErrors(data.errors || []);
        return;
      }

      setUploadedTemplate(data.template);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async () => {
    if (!uploadedTemplate) return;

    try {
      const token = await getAuthToken();
      if (!token) return;

      await fetch(`/api/admin/templates/${uploadedTemplate.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'active' }),
      });

      onSuccess();
      onClose();
    } catch {
      setError('Failed to activate template');
    }
  };

  const handleGenerate = async () => {
    if (!description || description.length < 10) return;

    setGenerating(true);
    setError(null);
    setGeneratedTemplate(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch('/api/admin/templates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description,
          accentColor,
          backgroundColor,
          style: selectedStyle,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError(data.error || 'Daily generation limit reached');
        setRateLimit({ limit: data.limit, used: data.used, remaining: 0 });
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Generation failed');
        return;
      }

      setGeneratedTemplate(data);
      if (data.remaining !== undefined) {
        setRateLimit(prev => prev ? { ...prev, remaining: data.remaining, used: prev.limit - data.remaining } : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!generatedTemplate || !generatedTemplate.validation.valid) return;

    setSaving(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Save via direct insert endpoint
      const res = await fetch('/api/admin/templates/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: generatedTemplate.code,
          manifest: generatedTemplate.manifest,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save template');
        return;
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-lg">Add Template</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === 'upload'
                ? 'text-cb-primary border-b-2 border-cb-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setTab('generate')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === 'generate'
                ? 'text-cb-primary border-b-2 border-cb-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            AI Generate
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {tab === 'upload' && (
            <div>
              {!uploadedTemplate ? (
                <>
                  {/* Drop zone */}
                  <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-cb-primary transition">
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600">
                      {file ? file.name : 'Drop ZIP file or click to browse'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Must contain: component.tsx, manifest.json, thumbnail.png
                    </p>
                  </label>

                  {/* Error display */}
                  {error && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                      {validationErrors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                          {validationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Upload button */}
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="mt-4 w-full py-2.5 bg-cb-primary text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cb-primary/90 transition"
                  >
                    {uploading ? 'Uploading...' : 'Upload & Validate'}
                  </button>
                </>
              ) : (
                <>
                  {/* Success state */}
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-lg">{uploadedTemplate.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">Template uploaded and validated</p>
                    <p className="text-xs text-amber-600 mt-2">Status: Draft</p>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={onClose}
                      className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                    >
                      Save as Draft
                    </button>
                    <button
                      onClick={handleActivate}
                      className="flex-1 py-2.5 bg-cb-green text-white rounded-lg text-sm font-medium hover:bg-cb-green/90 transition"
                    >
                      Activate Now
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'generate' && (
            <div>
              {/* Rate limit display */}
              {rateLimit && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${rateLimit.remaining === 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                  {rateLimit.remaining === 0 ? (
                    <span>Daily limit reached ({rateLimit.used}/{rateLimit.limit}). Try again tomorrow.</span>
                  ) : (
                    <span>Generations remaining today: {rateLimit.remaining}/{rateLimit.limit}</span>
                  )}
                </div>
              )}

              {!generatedTemplate ? (
                <>
                  {/* Description textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Describe your template style
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Modern Japanese minimalist with black accents and white space. Clean, editorial."
                      rows={3}
                      maxLength={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cb-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/300</p>
                  </div>

                  {/* Style pills */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_OPTIONS.map((style) => (
                        <button
                          key={style}
                          onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                            selectedStyle === style
                              ? 'bg-cb-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color pickers */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error display */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {/* Generate button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!description || description.length < 10 || generating || rateLimit?.remaining === 0}
                    className="w-full py-2.5 bg-cb-primary text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cb-primary/90 transition flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" className="opacity-75" />
                        </svg>
                        Generating... (15-30 seconds)
                      </>
                    ) : (
                      'Generate Template'
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Generated template result */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-lg">{generatedTemplate.manifest.name}</h3>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Draft</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{generatedTemplate.manifest.description}</p>

                    {/* Validation result */}
                    <div className={`p-3 rounded-lg mb-4 ${generatedTemplate.validation.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                      <h4 className={`text-sm font-medium mb-2 ${generatedTemplate.validation.valid ? 'text-green-700' : 'text-red-700'}`}>
                        {generatedTemplate.validation.valid ? 'Validation passed — ready to save' : 'Fix required before saving'}
                      </h4>
                      {generatedTemplate.validation.errors.length > 0 && (
                        <ul className="space-y-1">
                          {generatedTemplate.validation.errors.map((err, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-red-600">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {err}
                            </li>
                          ))}
                        </ul>
                      )}
                      {generatedTemplate.validation.warnings.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {generatedTemplate.validation.warnings.map((warn, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-amber-600">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {warn}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Token usage */}
                    <p className="text-xs text-gray-400 mb-4">Generated using {generatedTemplate.tokensUsed.toLocaleString()} tokens</p>

                    {/* Error display */}
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setGeneratedTemplate(null);
                          setError(null);
                        }}
                        className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={handleSaveAsDraft}
                        disabled={!generatedTemplate.validation.valid || saving}
                        className="flex-1 py-2.5 bg-cb-green text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cb-green/90 transition"
                      >
                        {saving ? 'Saving...' : 'Save as Draft'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [confirm, ConfirmDialog] = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch('/api/admin/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load templates');
      }

      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleStatus = async (template: Template) => {
    const newStatus = template.status === 'active' ? 'inactive' : 'active';

    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === template.id ? { ...t, status: newStatus } : t
      )
    );

    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        // Revert on error
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === template.id ? { ...t, status: template.status } : t
          )
        );
        const err = await res.json();
        setError(err.error || 'Failed to update status');
      }
    } catch (e) {
      // Revert on error
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, status: template.status } : t
        )
      );
      setError(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const handleDelete = async (template: Template) => {
    const confirmed = await confirm({
      title: 'Delete Template',
      body: `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Delete failed');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Templates</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {ConfirmDialog()}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-cb-primary text-white rounded-lg text-sm font-medium hover:bg-cb-primary/90 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Template
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onToggleStatus={handleToggleStatus}
            onPreview={setPreviewTemplate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No templates found.</p>
          <p className="text-sm mt-1">Add a template to get started.</p>
        </div>
      )}

      {/* Preview panel */}
      {previewTemplate && (
        <PreviewPanel
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
