// Image uploads and the media library picker. Photos are resized in the browser and re-encoded as JPEG,
// which also removes location (GPS) and camera data before anything leaves the computer.
import { Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/ui';
import { api } from '../lib/api';
import { imageUrl } from '../lib/images';

export type MediaItem = { id: string; name: string; alt: string; width: number; height: number; bytes: number; createdAt: string };

export const BUILTIN_LABELS: Record<string, string> = {
  hero: 'Homepage (rode Ferrari)',
  coatings: 'Glascoating (Ferrari)',
  'coatings-level-1': 'Mini Countryman',
  'coatings-level-2': 'Porsche Cayman',
  polijsten: 'Polijsten (Ferrari)',
  'polijsten-voor-na': 'Polijsten voor/na',
  'polijsten-stap-1': 'Polijsten werkplaats',
  'polijsten-stap-2': 'Polijsten koplamp',
  'luxe-handwas': 'Voorspoelen',
  'luxe-handwas-rsq8': 'Audi RS Q8',
  'handwas-op-locatie': 'Team op locatie',
  'handwas-op-locatie-velg': 'Velg Porsche',
  'handwas-abonnement': 'Audi RS Q8 (bos)',
  'interieur-reiniging': 'Interieur Porsche',
  'interieur-reiniging-dashboard': 'Dashboard',
  'interieur-reiniging-leer': 'Leer interieur',
  schadeherstel: 'Spuiten',
  'schadeherstel-deuken': 'Deuken',
  ppf: 'Porsche Cayman voorkant',
  'ppf-folie': 'PPF op een Porsche 911',
  'ppf-aanbrengen': 'PPF aanbrengen (deur)',
  'ppf-motorkap': 'PPF op de motorkap',
  team: 'Het team',
  'technische-ruimte': 'Motorruimte',
};

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older browsers: decode through an <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toJpeg(source: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function uploadImage(file: File, alt = ''): Promise<MediaItem> {
  if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type)) throw new Error('Kies een foto (JPG, PNG of WebP).');
  if (file.size > 40 * 1024 * 1024) throw new Error('Deze foto is groter dan 40 MB. Kies een kleinere.');
  let source;
  try {
    source = await loadImage(file);
  } catch {
    throw new Error('Deze foto kan niet worden gelezen. Sla hem op als JPG en probeer het opnieuw.');
  }
  const large = toJpeg(source, 1600, 0.85);
  const small = toJpeg(source, 800, 0.8);
  const name = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 120) || 'Afbeelding';
  return api<MediaItem>('/admin/media', { body: { name, alt, large, small } });
}

/** Lets the admin choose an uploaded image, a built-in photo, or upload a new one. */
export function MediaPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (ref: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>();
  const [builtin, setBuiltin] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<MediaItem[]>('/admin/media').then(setItems, () => setItems([]));
    api<{ builtinImages: string[] }>('/admin/content').then((c) => setBuiltin(c.builtinImages), () => {});
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(undefined);
    try {
      const first = await uploadImage(files[0]);
      onSelect(first.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uploaden is niet gelukt.');
    } finally {
      setBusy(false);
    }
  }

  const tile = 'group relative block aspect-[4/3] overflow-hidden border border-paper-3 bg-paper-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Afbeelding kiezen"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col bg-paper text-ink outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-paper-3 px-5 py-4">
          <h2 className="text-lg font-semibold">Afbeelding kiezen</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center hover:bg-paper-2" aria-label="Sluiten">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-paper-3 bg-white px-6 py-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files);
            }}
          >
            <Upload className="h-6 w-6 text-stone-dark" aria-hidden />
            <p className="text-sm text-stone-dark">Sleep een foto hierheen, of</p>
            <Button type="button" variant="dark" className="h-10 text-sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Bezig met uploaden…' : 'Foto uploaden'}
            </Button>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
            <p className="text-xs text-stone-dark">We verkleinen de foto automatisch en verwijderen locatie- en cameragegevens.</p>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <h3 className="eyebrow mb-3 mt-8 text-stone-dark">Jouw uploads</h3>
          {!items ? (
            <div className="h-24 animate-pulse bg-paper-3" />
          ) : items.length === 0 ? (
            <p className="text-sm text-stone-dark">Nog geen uploads.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((m) => (
                <button key={m.id} type="button" className={tile} onClick={() => onSelect(m.id)} title={m.name}>
                  <img src={imageUrl(m.id, 'sm')} alt={m.alt || m.name} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-2 py-1 text-xs text-paper">{m.name}</span>
                </button>
              ))}
            </div>
          )}

          <h3 className="eyebrow mb-3 mt-8 text-stone-dark">Foto’s van de website</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {builtin.map((ref) => (
              <button key={ref} type="button" className={tile} onClick={() => onSelect(ref)}>
                <img src={imageUrl(ref, 'sm')} alt={BUILTIN_LABELS[ref] ?? ref} loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-2 py-1 text-xs text-paper">{BUILTIN_LABELS[ref] ?? ref}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
