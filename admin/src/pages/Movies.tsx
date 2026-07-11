import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Plus, Pencil, Trash2, X, Film, Star, Sparkles, Upload } from 'lucide-react';

type MediaType = 'movie' | 'tv';

interface MoviesProps {
  typeFilter: 'movie' | 'tvshow';
  search: string;
}

const emptyForm = {
  title: '',
  overview: '',
  posterUrl: '',
  backdropUrl: '',
  trailerYoutubeKey: '',
  genreNames: '' as string, // comma-separated in the form, split on save
  releaseDate: '',
  rating: 7,
  featured: false,
};

export default function Movies({ typeFilter, search }: MoviesProps) {
  const mediaType: MediaType = typeFilter === 'tvshow' ? 'tv' : 'movie';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: all } = (await websiteApi.getContent()) as { items: any[] };
      let list = all.filter((m) => m.mediaType === mediaType);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter((m) => m.title.toLowerCase().includes(q));
      }
      setItems(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mediaType, search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setSaveError(null); setModalOpen(true); };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      title: m.title,
      overview: m.overview || '',
      posterUrl: m.posterUrl || '',
      backdropUrl: m.backdropUrl || '',
      trailerYoutubeKey: m.trailerYoutubeKey || '',
      genreNames: (m.genreNames || []).join(', '),
      releaseDate: m.releaseDate || '',
      rating: m.rating ?? 7,
      featured: !!m.featured,
    });
    setSaveError(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.posterUrl.trim()) {
      setSaveError('Title and a poster image URL are both required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = {
      title: form.title.trim(),
      overview: form.overview.trim(),
      posterUrl: form.posterUrl.trim(),
      backdropUrl: form.backdropUrl.trim() || form.posterUrl.trim(),
      trailerYoutubeKey: form.trailerYoutubeKey.trim(),
      mediaType,
      genreNames: form.genreNames.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 6),
      releaseDate: form.releaseDate || undefined,
      rating: Number(form.rating) || 0,
      featured: form.featured,
    };
    try {
      if (editing) await websiteApi.updateContent(editing.id, payload);
      else await websiteApi.createContent(payload);
      setModalOpen(false);
      load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: any) => {
    if (!confirm(`Delete "${m.title}"? This removes it from the live website immediately.`)) return;
    try {
      await websiteApi.deleteContent(m.id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const label = mediaType === 'tv' ? 'TV Show' : 'Movie';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{label}s</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Cinemax Originals — admin-authored titles shown on the website's homepage, alongside the TMDB catalog.
          </p>
        </div>
        <button onClick={openNew} className="neon-btn flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm cursor-pointer">
          <Plus className="w-4 h-4" /> Add {label}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
          <Film className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {label.toLowerCase()}s yet. Add your first one to feature it on the homepage.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((m) => (
            <div key={m.id} className="rounded-2xl overflow-hidden group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="aspect-[2/3] relative overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                {m.posterUrl ? <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" /> : <Film className="w-8 h-8 m-auto" style={{ color: 'var(--text-faint)' }} />}
                {m.featured && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: 'var(--accent)', color: '#050505' }}>
                    <Sparkles className="w-3 h-3" /> Featured
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <button onClick={() => openEdit(m)} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'var(--accent)', color: '#050505' }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(m)} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-white truncate">{m.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{(m.releaseDate || '').slice(0, 4) || '—'}</span>
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                    <Star className="w-3 h-3 fill-current" /> {m.rating?.toFixed?.(1) ?? m.rating}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'Add'} {label}</h2>
              <button onClick={() => setModalOpen(false)} className="cursor-pointer"><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            <Field label="Title *"><input className="input-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Overview"><textarea rows={3} className="input-base resize-none" value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poster Image *">
                <ImageInput
                  value={form.posterUrl}
                  onChange={(v) => setForm({ ...form, posterUrl: v })}
                  onError={setSaveError}
                />
              </Field>
              <Field label="Backdrop Image">
                <ImageInput
                  value={form.backdropUrl}
                  onChange={(v) => setForm({ ...form, backdropUrl: v })}
                  onError={setSaveError}
                />
              </Field>
            </div>
            <Field label="YouTube Trailer Key (e.g. dQw4w9WgXcQ)"><input className="input-base" value={form.trailerYoutubeKey} onChange={(e) => setForm({ ...form, trailerYoutubeKey: e.target.value })} /></Field>
            <Field label="Genres (comma-separated)"><input className="input-base" placeholder="Action, Sci-Fi" value={form.genreNames} onChange={(e) => setForm({ ...form, genreNames: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Release Date"><input type="date" className="input-base" value={form.releaseDate || ''} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></Field>
              <Field label="Rating (0–10)"><input type="number" min={0} max={10} step={0.1} className="input-base" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} /></Field>
            </div>
            <label className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Feature on homepage</span>
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4" />
            </label>

            {saveError && <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{saveError}</p>}

            <button onClick={save} disabled={saving} className="w-full neon-btn font-bold py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-60">
              {saving ? 'Saving...' : editing ? 'Save Changes' : `Add ${label}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Image input that accepts either a hosted URL or a local file upload
 * (converted to a data URL so it merges into the same list as remote titles).
 * Keeps the input as a single value string so the save payload is unchanged.
 */
function ImageInput({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (v: string) => void;
  onError: (msg: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file (PNG, JPG, WebP).');
      return;
    }
    // ~4MB cap so the JSON payload stays reasonable when embedded as base64.
    if (file.size > 4 * 1024 * 1024) {
      onError('Image is over 4MB. Please choose a smaller file or paste a URL.');
      return;
    }
    setUploading(true);
    onError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error('Read failed'));
        reader.readAsDataURL(file);
      });
      onChange(dataUrl);
    } catch (err: any) {
      onError(err?.message || 'Could not read that file.');
    } finally {
      setUploading(false);
    }
  };

  const isDataUrl = value.startsWith('data:');
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input-base flex-1"
          placeholder="https://... or upload"
          value={isDataUrl ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
          style={{ background: 'rgba(57,255,20,0.1)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.25)' }}
          title="Upload from your device"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? '...' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      {value && (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt=""
            className="w-12 h-16 object-cover rounded-md"
            style={{ background: 'var(--surface-3)' }}
          />
          {isDataUrl && (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Local upload — will be saved with this title.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
