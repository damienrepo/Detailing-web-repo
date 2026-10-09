import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { slugify } from '../../../shared/blog';
import type { Product } from '../../../shared/catalog';
import { formatPrice } from '../../../shared/pricing';
import { ProductImage } from '../../components/ProductArt';
import { Button, ButtonLink, Input, Select, Textarea } from '../../components/ui';
import { confirmAction } from '../../lib/demo';
import { useContent } from '../content';
import { ShopSwitch } from '../ShopSwitch';
import { ErrorBox, errorFor, ImageField, LineList, Loading, MoneyInput, PageHeader, Panel, RecordList, SaveBar, StatusBadge, Toggle, useDraft, useSave, useToast } from '../kit';

export function ProductsPage() {
  const content = useContent();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const products = content.data?.products;
  if (!products) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;

  async function reorder(from: number, to: number) {
    const ids = products!.map((p) => p.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    try {
      await content.save('/admin/products-order', { ids });
      toast('Volgorde opgeslagen');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan is niet gelukt.');
    }
  }

  return (
    <>
      <PageHeader
        title="Producten"
        description="Voeg producten toe, wijzig prijzen of zet iets op uitverkocht. De volgorde hier is de volgorde in de shop."
        actions={
          <ButtonLink to="/admin/producten/nieuw" variant="dark" className="h-10 text-sm">
            <Plus className="h-4 w-4" aria-hidden />
            Product toevoegen
          </ButtonLink>
        }
      />
      <div className="mb-6">
        <ShopSwitch />
      </div>
      {error && <ErrorBox message={error} />}
      <ul className="divide-y divide-paper-3 border border-paper-3 bg-white">
        {products.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 p-3">
            <div className="flex flex-col">
              <button type="button" className="grid h-7 w-7 place-items-center text-stone-dark hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => reorder(i, i - 1)} aria-label={`${p.name} omhoog`}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="grid h-7 w-7 place-items-center text-stone-dark hover:text-ink disabled:opacity-30" disabled={i === products.length - 1} onClick={() => reorder(i, i + 1)} aria-label={`${p.name} omlaag`}>
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <Link to={`/admin/producten/${p.id}`} className="flex flex-1 items-center gap-4 p-1 hover:bg-paper/60">
              <div className={`w-14 shrink-0 ${p.hidden ? 'opacity-40' : ''}`}>
                <ProductImage productId={p.id} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="tabular text-sm text-stone-dark">
                  {formatPrice(p.price)} · {p.sku}
                  {p.includes?.length ? ' · set' : ''}
                </p>
              </div>
              {p.hidden ? <StatusBadge tone="muted">Verborgen</StatusBadge> : !p.inStock ? <StatusBadge tone="warn">Uitverkocht</StatusBadge> : <StatusBadge tone="ok">Te koop</StatusBadge>}
              <ChevronRight className="h-4 w-4 text-stone-dark" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

const EMPTY: Product = {
  id: '',
  slug: '',
  sku: '',
  name: '',
  category: '',
  tagline: '',
  description: [''],
  price: 0,
  size: '',
  highlights: [],
  specs: [],
  usage: [],
  inStock: true,
  hidden: false,
};

export function ProductEditor() {
  const { id = '' } = useParams();
  const isNew = id === 'nieuw';
  const navigate = useNavigate();
  const content = useContent();
  const existing = content.data?.products.find((p) => p.id === id);
  const initial = useMemo(() => (isNew ? (content.data ? EMPTY : undefined) : existing), [isNew, existing, content.data]);
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<Product>(initial);
  const save = useSave();
  const [slugTouched, setSlugTouched] = useState(!isNew);

  if (content.data && !isNew && !existing) return <ErrorBox message="Dit product bestaat niet (meer)." />;
  if (!draft || !content.data) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;
  const e = save.errors;
  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft({ ...draft, [key]: value });
  const others = content.data.products.filter((p) => p.id !== draft.id && !p.includes?.length);

  async function submit() {
    const body = { ...draft!, id: isNew ? draft!.slug : draft!.id, hidden: draft!.hidden ?? false };
    if (!body.includes?.length) delete body.includes;
    const view = await save.run(() => (isNew ? content.save('/admin/products', body, 'POST') : content.save(`/admin/products/${id}`, body)), isNew ? 'Product toegevoegd' : 'Opgeslagen');
    if (!view) return;
    const saved = view.products.find((p) => p.id === body.id)!;
    markSaved(saved);
    if (isNew) navigate(`/admin/producten/${saved.id}`, { replace: true });
  }

  async function remove() {
    if (!confirmAction(`"${draft!.name}" definitief verwijderen? Bestaande bestellingen blijven bewaard. Tip: je kunt een product ook verbergen.`)) return;
    const view = await save.run(() => content.remove(`/admin/products/${id}`), 'Product verwijderd');
    if (view) {
      markSaved(draft!);
      navigate('/admin/producten');
    }
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'Nieuw product' : draft.name || 'Product'}
        back={{ to: '/admin/producten', label: 'Alle producten' }}
        actions={
          !isNew &&
          !draft.hidden && (
            <a href={`/shop/${existing!.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-medium hover:border-ink">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Bekijk in de shop
            </a>
          )
        }
      />
      <div className="space-y-6">
        <Panel>
          <Toggle label="Tonen in de shop" description="Uit = niet zichtbaar en niet te bestellen." checked={!draft.hidden} onChange={(v) => set('hidden', !v)} />
          <Toggle label="Op voorraad" description="Uit = zichtbaar als ‘Uitverkocht’." checked={draft.inStock} onChange={(v) => set('inStock', v)} />
        </Panel>

        <Panel title="Basis">
          <Input
            label="Naam"
            value={draft.name}
            error={e.name}
            onChange={(ev) => setDraft({ ...draft, name: ev.target.value, ...(slugTouched ? {} : { slug: slugify(ev.target.value) }) })}
          />
          <Input label="Korte omschrijving" value={draft.tagline} error={e.tagline} hint="Eén zin onder de naam." onChange={(ev) => set('tagline', ev.target.value)} />
          <div className="grid gap-5 sm:grid-cols-3">
            <Input label="Categorie" value={draft.category} error={e.category} placeholder="Bijv. Reiniger" onChange={(ev) => set('category', ev.target.value)} />
            <Input label="Inhoud of maat" value={draft.size} error={e.size} placeholder="Bijv. 500 ml" onChange={(ev) => set('size', ev.target.value)} />
            <Input label="Label op de foto" value={draft.badge ?? ''} error={e.badge} optional placeholder="Bijv. Nieuw" onChange={(ev) => set('badge', ev.target.value)} />
          </div>
        </Panel>

        <Panel title="Prijs">
          <div className="grid gap-5 sm:grid-cols-2">
            <MoneyInput label="Prijs" cents={draft.price} error={e.price} onChange={(v) => set('price', v ?? 0)} />
            <MoneyInput label="Oude prijs (doorgestreept)" cents={draft.compareAtPrice} error={e.compareAtPrice} optional hint="Optioneel, bijv. de losse prijs van een set." onChange={(v) => set('compareAtPrice', v ?? undefined)} />
          </div>
        </Panel>

        <Panel title="Foto">
          <ImageField label="Productfoto" hint="Vierkant op een lichte achtergrond werkt het best." value={draft.image} optional onChange={(v) => set('image', v ?? undefined)} error={e.image} />
        </Panel>

        <Panel title="Beschrijving">
          <LineList label="Alinea’s" items={draft.description} onChange={(v) => set('description', v)} long addLabel="Alinea toevoegen" error={errorFor(e, 'description')} max={8} />
          <LineList label="Kenmerken (opsomming)" items={draft.highlights} onChange={(v) => set('highlights', v)} placeholder="Bijv. Matte, streeploze afwerking" error={errorFor(e, 'highlights')} max={10} />
          <LineList label="Gebruik (stappen)" items={draft.usage} onChange={(v) => set('usage', v)} placeholder="Bijv. Goed schudden voor gebruik." error={errorFor(e, 'usage')} max={12} />
          <RecordList
            label="Specificaties"
            items={draft.specs}
            onChange={(v) => set('specs', v)}
            fields={[
              { key: 'label', label: 'Kenmerk', placeholder: 'Bijv. Inhoud' },
              { key: 'value', label: 'Waarde', placeholder: 'Bijv. 500 ml spuitflacon' },
            ]}
            empty={{ label: '', value: '' }}
            addLabel="Specificatie toevoegen"
            error={errorFor(e, 'specs')}
            max={15}
          />
        </Panel>

        <Panel title="Set" description="Is dit een set van andere producten? Voeg ze hier toe. De shop stelt klanten dan automatisch voor om losse onderdelen om te wisselen voor de set.">
          <ul className="space-y-2">
            {(draft.includes ?? []).map((inc, i) => (
              <li key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select label={`Product ${i + 1}`} value={inc.productId} onChange={(ev) => set('includes', draft.includes!.map((x, j) => (j === i ? { ...x, productId: ev.target.value } : x)))}>
                    {others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Input label="Aantal" type="number" min={1} max={20} value={inc.quantity} onChange={(ev) => set('includes', draft.includes!.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(ev.target.value) || 1) } : x)))} />
                </div>
                <button type="button" className="grid h-12 w-10 place-items-center text-stone-dark hover:text-danger" onClick={() => set('includes', draft.includes!.filter((_, j) => j !== i))} aria-label="Uit de set halen">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {e.includes && <p className="text-sm text-danger">{e.includes}</p>}
          {others.length > 0 && (
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline" onClick={() => set('includes', [...(draft.includes ?? []), { productId: others[0].id, quantity: 1 }])}>
              <Plus className="h-4 w-4" aria-hidden />
              Product aan set toevoegen
            </button>
          )}
        </Panel>

        <Panel title="Gegevens voor de shop">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Webadres"
              value={draft.slug}
              error={e.slug}
              hint={`detail2go.nl/shop/${draft.slug || '…'}`}
              onChange={(ev) => {
                setSlugTouched(true);
                set('slug', slugify(ev.target.value));
              }}
            />
            <Input label="Artikelnummer (SKU)" value={draft.sku} error={e.sku} placeholder="Bijv. D2G-VR-500" onChange={(ev) => set('sku', ev.target.value.toUpperCase())} />
          </div>
          {!isNew && <p className="text-sm text-stone-dark">Let op: als je het webadres wijzigt, werken oude links naar dit product niet meer.</p>}
        </Panel>

        {!isNew && (
          <Panel title="Verwijderen">
            <p className="text-sm text-stone-dark">Bestellingen waarin dit product zit blijven bewaard. Wil je het later misschien weer verkopen? Verberg het dan liever.</p>
            <Button type="button" variant="outline-dark" className="h-10 text-sm hover:border-danger hover:text-danger" onClick={remove}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Product verwijderen
            </Button>
          </Panel>
        )}
      </div>

      <SaveBar dirty={dirty || isNew} saving={save.saving} error={save.error} onSave={submit} onReset={reset} />
    </>
  );
}
