import { Copy, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Input } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { imageUrl } from '../../lib/images';
import { ErrorBox, Loading, PageHeader, useAdminData, useToast } from '../kit';
import { BUILTIN_IMAGES } from '../../../shared/content';
import { BUILTIN_LABELS, uploadImage, type MediaItem } from '../media';

export function MediaPage() {
  const toast = useToast();
  const { data, setData, error, reload } = useAdminData<MediaItem[]>('/admin/media');
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [problems, setProblems] = useState<string[]>([]);
  const [selected, setSelected] = useState<MediaItem>();
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setProblems([]);
    setProgress({ done: 0, total: list.length });
    const failed: string[] = [];
    for (const [i, file] of list.entries()) {
      try {
        const item = await uploadImage(file);
        setData((d) => [item, ...(d ?? [])]);
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : 'uploaden mislukt'}`);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(undefined);
    setProblems(failed);
    if (failed.length < list.length) toast(`${list.length - failed.length} foto${list.length - failed.length === 1 ? '' : '’s'} geüpload`);
  }

  return (
    <>
      <PageHeader
        title="Afbeeldingen"
        description="Upload hier je eigen foto’s. Daarna kun je ze kiezen bij blogberichten, producten, diensten en de homepage."
        actions={
          <Button variant="dark" className="h-10 text-sm" onClick={() => input.current?.click()} disabled={Boolean(progress)}>
            <Upload className="h-4 w-4" aria-hidden />
            {progress ? `Uploaden ${progress.done}/${progress.total}…` : 'Foto’s uploaden'}
          </Button>
        }
      />
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files).finally(() => (e.target.value = ''))} />

      <div
        className="mb-6 border-2 border-dashed border-paper-3 bg-white px-6 py-6 text-center text-sm text-stone-dark"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        Sleep foto’s hierheen om ze te uploaden. Grote foto’s worden automatisch verkleind, en locatie- en cameragegevens worden verwijderd.
      </div>
      {problems.length > 0 && <ErrorBox message={problems.join(' · ')} />}
      {error && <ErrorBox message={error} onRetry={reload} />}

      {!data ? (
        !error && <Loading />
      ) : data.length === 0 ? (
        <p className="py-12 text-center text-stone-dark">Nog geen foto’s geüpload.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((m) => (
            <button key={m.id} type="button" onClick={() => setSelected(m)} className={`group block border bg-white text-left ${selected?.id === m.id ? 'border-ink' : 'border-paper-3 hover:border-ink/40'}`}>
              <div className="aspect-[4/3] overflow-hidden bg-paper-2">
                <img src={imageUrl(m.id, 'sm')} alt={m.alt || m.name} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="text-xs text-stone-dark">
                  {m.width} × {m.height} · {(m.bytes / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Foto’s van de website</h2>
        <p className="mt-1 text-sm text-stone-dark">
          Deze foto’s horen bij de website en blijven altijd beschikbaar. Je kunt ze overal kiezen, ook als je ze ergens hebt vervangen.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {BUILTIN_IMAGES.map((ref) => (
            <figure key={ref} className="border border-paper-3 bg-white">
              <div className="aspect-[4/3] overflow-hidden bg-paper-2">
                <img src={imageUrl(ref, 'sm')} alt={BUILTIN_LABELS[ref] ?? ref} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <figcaption className="truncate p-3 text-sm font-medium">{BUILTIN_LABELS[ref] ?? ref}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {selected && (
        <MediaDetails
          key={selected.id}
          item={selected}
          onClose={() => setSelected(undefined)}
          onSaved={(item) => {
            setData((d) => d?.map((x) => (x.id === item.id ? item : x)));
            setSelected(item);
          }}
          onDeleted={(id) => {
            setData((d) => d?.filter((x) => x.id !== id));
            setSelected(undefined);
          }}
        />
      )}
    </>
  );
}

function MediaDetails({ item, onClose, onSaved, onDeleted }: { item: MediaItem; onClose: () => void; onSaved: (m: MediaItem) => void; onDeleted: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [alt, setAlt] = useState(item.alt);
  const [error, setError] = useState<string>();

  async function save() {
    try {
      onSaved(await api<MediaItem>(`/admin/media/${item.id}`, { method: 'PATCH', body: { name, alt } }));
      toast('Opgeslagen');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan is niet gelukt.');
    }
  }

  async function remove(force = false) {
    try {
      await api(`/admin/media/${item.id}${force ? '?force=1' : ''}`, { method: 'DELETE' });
      onDeleted(item.id);
      toast('Afbeelding verwijderd');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        if (window.confirm(`${err.message}\n\nToch verwijderen? Op die plekken verdwijnt de foto dan.`)) remove(true);
      } else setError(err instanceof Error ? err.message : 'Verwijderen is niet gelukt.');
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-paper-3 bg-paper shadow-2xl">
      <div className="flex items-center justify-between border-b border-paper-3 px-5 py-4">
        <h2 className="text-lg font-semibold">Afbeelding</h2>
        <button type="button" onClick={onClose} className="text-sm underline underline-offset-2">
          Sluiten
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <img src={imageUrl(item.id)} alt={item.alt || item.name} className="w-full border border-paper-3" />
        {error && <ErrorBox message={error} />}
        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} hint="Alleen voor jezelf, om de foto terug te vinden." />
        <Input label="Omschrijving (alt-tekst)" value={alt} onChange={(e) => setAlt(e.target.value)} optional hint="Wat staat er op de foto? Helpt slechtzienden en Google." />
        <Button variant="dark" className="h-10 text-sm" onClick={save} disabled={!name.trim() || (name === item.name && alt === item.alt)}>
          Opslaan
        </Button>
        <div className="border-t border-paper-3 pt-5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
            onClick={() => navigator.clipboard?.writeText(`![${alt || name}](${item.id})`).then(() => toast('Gekopieerd: plak dit in een blogbericht'))}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Kopieer code voor in een blogbericht
          </button>
        </div>
        <button type="button" onClick={() => remove()} className="inline-flex items-center gap-1.5 text-sm text-stone-dark hover:text-danger">
          <Trash2 className="h-4 w-4" aria-hidden />
          Verwijderen
        </button>
      </div>
    </div>
  );
}
