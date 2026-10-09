import { Quote } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PublicTeamMember } from '../../shared/team';
import { SITE } from '../../shared/site';
import { Reveal } from '../components/Reveal';
import { ClosingCta } from '../components/Section';
import { Eyebrow } from '../components/ui';
import { api } from '../lib/api';
import { imageSrcSet, imageUrl } from '../lib/images';
import { usePageMeta } from '../lib/meta';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-ZÀ-Ý]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join('') || name.slice(0, 1).toUpperCase();

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export default function Team() {
  usePageMeta('Ons team', `Maak kennis met de mensen achter ${SITE.fullName}.`);
  const [team, setTeam] = useState<PublicTeamMember[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    api<PublicTeamMember[]>('/team')
      .then(setTeam)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <section className="bg-ink pb-16 pt-16 text-paper md:pb-24 md:pt-[72px]">
        <div className="container-page pt-16 md:pt-24">
          <Eyebrow className="text-paper/60">Ons team</Eyebrow>
          <div className="mt-6 grid gap-8 md:grid-cols-12 md:items-end">
            <h1 className="font-display text-[clamp(2.75rem,7vw,5rem)] leading-[0.95] md:col-span-8">
              De handen achter <span className="text-accent">de glans.</span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-paper/70 md:col-span-4">
              Geen anonieme wasstraat, maar mensen met passie voor auto’s. Dit zijn wij, en dit is waarom we doen wat we doen.
            </p>
          </div>
          {team && team.length > 1 && (
            <ul className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6">
              {team.map((m, i) => (
                <li key={m.id}>
                  <a href={`#lid-${m.id}`} className="group inline-flex items-baseline gap-2 text-paper/60 transition-colors hover:text-paper">
                    <span className="tabular font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[15px]">{m.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {error && (
        <section className="bg-ink-2 py-20 text-paper">
          <p className="container-page text-paper/70">Het team kon niet worden geladen. Probeer het later opnieuw.</p>
        </section>
      )}
      {!team && !error && (
        <section className="bg-ink-2 py-20">
          <div className="container-page grid gap-10 md:grid-cols-12" aria-label="Laden">
            <div className="aspect-[4/5] animate-pulse bg-ink-3 md:col-span-5" />
            <div className="space-y-4 md:col-span-7">
              <div className="h-12 w-2/3 animate-pulse bg-ink-3" />
              <div className="h-40 animate-pulse bg-ink-3" />
            </div>
          </div>
        </section>
      )}
      {team?.length === 0 && <EmptyTeam />}
      {team?.map((member, i) => <MemberSection key={member.id} member={member} index={i} />)}

      <ClosingCta title="Zin om kennis te maken?" text="Kom langs in de werkplaats of laat ons bij jou op locatie komen. We vertellen je graag wat we voor je auto kunnen doen." />
    </>
  );
}

function MemberSection({ member, index }: { member: PublicTeamMember; index: number }) {
  const flip = index % 2 === 1;
  const number = String(index + 1).padStart(2, '0');

  return (
    <section id={`lid-${member.id}`} className={`scroll-mt-16 py-20 text-paper md:py-28 ${flip ? 'bg-ink' : 'bg-ink-2'}`}>
      <div className="container-page grid gap-10 md:grid-cols-12 md:items-center lg:gap-16">
        <Reveal className={`md:col-span-5 ${flip ? 'md:order-2 md:col-start-8' : ''}`}>
          <figure className="group relative">
            {/* Gold frame offset behind the photo. */}
            <div aria-hidden className={`absolute -bottom-3 h-full w-full border border-accent/40 ${flip ? '-left-3' : '-right-3'}`} />
            <div className="relative aspect-[4/5] overflow-hidden bg-ink-3">
              {member.photo ? (
                <img
                  src={imageUrl(member.photo, 'sm')}
                  srcSet={imageSrcSet(member.photo)}
                  sizes="(min-width: 768px) 40vw, 100vw"
                  alt={`${member.name}, ${member.role}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out-quart group-hover:scale-[1.03]"
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <span className="font-logo text-[clamp(4rem,12vw,8rem)] font-bold text-paper/10">{initials(member.name)}</span>
                </div>
              )}
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/70 to-transparent" />
              <span aria-hidden className="font-display absolute bottom-4 left-5 text-6xl leading-none text-paper/90 md:text-7xl">
                {number}
              </span>
            </div>
          </figure>
        </Reveal>

        <div className={`md:col-span-7 ${flip ? 'md:order-1 md:col-start-1 md:row-start-1' : ''}`}>
          <Eyebrow index={number} className="text-accent">
            {member.role}
          </Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98]">{member.name}</h2>

          {member.quote && (
            <blockquote className="relative mt-8 border-l-2 border-accent pl-6">
              <Quote className="absolute -top-1 right-0 h-10 w-10 text-paper/5" aria-hidden />
              <p className="text-xl leading-snug text-paper md:text-2xl">{member.quote}</p>
            </blockquote>
          )}

          {member.bio && (
            <div className="mt-8 space-y-4 text-[17px] leading-relaxed text-paper/70">
              {paragraphs(member.bio).map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          )}

          {member.facts.length > 0 && (
            <dl className="mt-10 grid gap-px bg-white/10 sm:grid-cols-2">
              {member.facts.map((f, i) => (
                <div key={i} className={`p-5 ${flip ? 'bg-ink' : 'bg-ink-2'}`}>
                  <dt className="eyebrow text-paper/45">{f.label}</dt>
                  <dd className="mt-2 text-[17px] font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

/** Shown until the team has been filled in via the admin. */
function EmptyTeam() {
  return (
    <section className="bg-ink-2 py-20 text-paper md:py-28">
      <div className="container-page grid gap-10 md:grid-cols-12 md:items-center">
        <figure className="aspect-[16/10] overflow-hidden bg-ink-3 md:col-span-7">
          <img src={imageUrl('team', 'sm')} srcSet={imageSrcSet('team')} sizes="(min-width: 768px) 55vw, 100vw" alt={`Het team van ${SITE.name}`} className="h-full w-full object-cover" />
        </figure>
        <p className="text-lg leading-relaxed text-paper/70 md:col-span-5">Binnenkort stellen we ons hier uitgebreid aan je voor.</p>
      </div>
    </section>
  );
}
