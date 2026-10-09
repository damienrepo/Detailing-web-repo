import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ABOUT } from '../../shared/content';
import { SITE } from '../../shared/site';
import type { PublicTeamMember } from '../../shared/team';
import { Reveal } from '../components/Reveal';
import { ClosingCta, SectionHeading } from '../components/Section';
import { ButtonLink, Eyebrow, TextLink } from '../components/ui';
import { api } from '../lib/api';
import { imageSrcSet, imageUrl } from '../lib/images';
import { usePageMeta } from '../lib/meta';

/** "Damiën, Stein & Bram" */
const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0] ?? '');

export default function About() {
  usePageMeta('Over ons', `Het verhaal achter ${SITE.fullName}: wie we zijn, waarom we het doen en waar we voor staan.`);
  const [team, setTeam] = useState<PublicTeamMember[]>([]);
  useEffect(() => {
    api<PublicTeamMember[]>('/team')
      .then(setTeam)
      .catch(() => setTeam([]));
  }, []);
  const [first, ...rest] = ABOUT.heroTitle.split('\n');

  return (
    <>
      <section className="bg-ink pt-16 text-paper md:pt-[72px]">
        <div className="container-page pb-14 pt-16 md:pb-20 md:pt-24">
          <Eyebrow className="text-paper/60">Over ons</Eyebrow>
          <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">
            {first}
            {rest.map((line) => (
              <span key={line}>
                <br />
                <span className="text-accent">{line}</span>
              </span>
            ))}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">{ABOUT.heroText}</p>
        </div>
        <div className="container-page">
          <figure className="relative aspect-[16/9] overflow-hidden bg-ink-3 md:aspect-[21/9]">
            <img src={imageUrl(ABOUT.image)} srcSet={imageSrcSet(ABOUT.image)} sizes="100vw" alt={`Het team van ${SITE.name}`} className="h-full w-full object-cover" fetchPriority="high" />
          </figure>
        </div>
        {ABOUT.facts.length > 0 && (
          <div className="container-page">
            <dl className={`grid border-b border-white/10 sm:grid-cols-2 ${ABOUT.facts.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {ABOUT.facts.map((f, i) => (
                <div key={i} className="border-white/10 py-8 sm:px-6 sm:first:pl-0 lg:border-l lg:first:border-l-0">
                  <dt className="sr-only">{f.label}</dt>
                  <dd>
                    <span className="font-display block text-4xl text-accent md:text-5xl">{f.value}</span>
                    <span className="mt-2 block text-[15px] text-paper/60">{f.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <section className="bg-paper py-24 text-ink md:py-32">
        <div className="container-page grid gap-12 md:grid-cols-12 lg:gap-16">
          <div className="md:col-span-4">
            <div className="md:sticky md:top-28">
              <Eyebrow index="01" tone="light" className="text-stone-dark">
                Het begin
              </Eyebrow>
              <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">{ABOUT.storyTitle}</h2>
            </div>
          </div>
          <div className="md:col-span-8">
            <div className="space-y-6 text-[19px] leading-[1.7] text-ink/80">
              {ABOUT.story.map((p, i) => (
                <p key={i} className={i === 0 ? 'text-[22px] leading-[1.55] text-ink' : ''}>
                  {p}
                </p>
              ))}
            </div>
            {ABOUT.quote && (
              <blockquote className="mt-14 border-l-2 border-accent pl-6 md:pl-8">
                <p className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight">“{ABOUT.quote}”</p>
                <footer className="mt-4 text-sm text-stone-dark">{team.length ? joinNames(team.map((m) => m.name.split(' ')[0])) : SITE.fullName}</footer>
              </blockquote>
            )}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink py-24 text-paper md:py-36">
        <span aria-hidden className="font-logo pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 select-none text-[28vw] font-bold leading-none text-white/[0.03]">
          2
        </span>
        <div className="container-page relative max-w-4xl text-center">
          <Eyebrow index="02" className="justify-center text-paper/60">
            {ABOUT.whyTitle}
          </Eyebrow>
          <p className="font-display mt-8 text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.2]">{ABOUT.whyText}</p>
        </div>
      </section>

      {ABOUT.values.length > 0 && (
        <section className="bg-ink-2 py-24 text-paper md:py-32">
          <div className="container-page">
            <SectionHeading index="03" eyebrow="Waar we voor staan" title="Zo werken wij." />
            <ul className={`mt-14 grid gap-px bg-white/10 sm:grid-cols-2 ${ABOUT.values.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {ABOUT.values.map((v, i) => (
                <li key={v.title} className="bg-ink-2 p-8">
                  <Reveal delay={i * 0.06}>
                    <p className="tabular font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</p>
                    <h3 className="font-display mt-6 text-2xl">{v.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-paper/65">{v.text}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="bg-paper py-24 text-ink md:py-32">
        <div className="container-page">
          <SectionHeading
            tone="light"
            index="04"
            eyebrow="Het team"
            title="De mensen achter de glans."
            intro="Maak kennis met wie er aan je auto werkt: hun achtergrond, hun drijfveer en hun droomauto."
          />
          {team.length > 0 ? (
            <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((m) => (
                <li key={m.id}>
                  <Link to={`/team#lid-${m.id}`} className="group block">
                    <div className="aspect-[4/5] overflow-hidden bg-paper-3">
                      {m.photo ? (
                        <img
                          src={imageUrl(m.photo, 'sm')}
                          srcSet={imageSrcSet(m.photo)}
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          alt={`${m.name}, ${m.role}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 ease-out-quart group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <span className="font-logo text-7xl font-bold text-ink/10">{m.name.slice(0, 1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink/15 pt-4">
                      <div>
                        <p className="font-display text-2xl">{m.name}</p>
                        <p className="text-sm text-stone-dark">{m.role}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-accent-strong transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-12">
              <ButtonLink to="/team" variant="outline-dark" arrow>
                Ontmoet het team
              </ButtonLink>
            </div>
          )}
          {team.length > 0 && (
            <div className="mt-12">
              <TextLink to="/team" className="text-ink">
                Lees hun verhalen
              </TextLink>
            </div>
          )}
        </div>
      </section>

      <ClosingCta title="Word onderdeel van de familie." text="Vraag een afspraak aan of stel gerust eerst een vraag. We denken graag met je mee." />
    </>
  );
}
