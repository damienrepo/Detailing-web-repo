import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import type { Service } from '../../shared/services';

import { imageSrcSet, imageUrl } from '../lib/images';

export const serviceImage = imageUrl;
export const serviceSrcSet = imageSrcSet;

/** `wide` lays the photo next to the text, for a category with a single service. */
export function ServiceCard({ service, wide = false }: { service: Service; wide?: boolean }) {
  return (
    <Link
      to={`/diensten/${service.id}`}
      className={`group flex h-full flex-col bg-ink-2 transition-colors hover:bg-ink-3 ${wide ? 'md:grid md:grid-cols-2' : ''}`}
    >
      <div className={`relative overflow-hidden bg-ink-3 ${wide ? 'aspect-[4/3] md:aspect-auto md:min-h-80' : 'aspect-[4/3]'}`}>
        <img
          src={serviceImage(service.image, 'sm')}
          srcSet={serviceSrcSet(service.image)}
          sizes={wide ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out-quart group-hover:scale-[1.03] md:absolute md:inset-0"
        />
        {service.onLocation && (
          <span className="eyebrow absolute left-4 top-4 inline-flex items-center gap-1.5 bg-ink/80 px-2.5 py-1.5 text-paper backdrop-blur-sm">
            <MapPin className="h-3 w-3 text-accent" aria-hidden />
            Ook op locatie
          </span>
        )}
      </div>
      <div className={`flex flex-1 flex-col ${wide ? 'p-6 md:p-10' : 'p-6'}`}>
        <h3 className={`font-display ${wide ? 'text-2xl md:text-4xl' : 'text-2xl'}`}>{service.name}</h3>
        <p className="mb-6 mt-2 text-[15px] leading-relaxed text-paper/65">{wide ? service.summary : service.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-5">
          <span className="text-sm text-paper/80 transition-colors group-hover:text-paper">Lees meer</span>
          <ArrowRight className="h-4 w-4 text-accent transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
