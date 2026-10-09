// Image references: uploads ('m_…'), built-in photos ('coatings'), files under public/ ('/x.jpg') or full URLs.

const UPLOAD = /^m_[a-z0-9]{16}$/;

export function imageUrl(ref: string, size: 'lg' | 'sm' = 'lg'): string {
  if (/^https?:\/\//.test(ref) || ref.startsWith('/')) return ref;
  if (UPLOAD.test(ref)) return `/media/${ref}${size === 'sm' ? '-sm' : ''}.jpg`;
  return `${import.meta.env.BASE_URL}services/${ref}${size === 'sm' ? '-sm' : ''}.jpg`;
}

/** srcset with the small and large variant, where both exist. */
export function imageSrcSet(ref: string): string | undefined {
  if (/^https?:\/\//.test(ref) || ref.startsWith('/')) return undefined;
  return `${imageUrl(ref, 'sm')} 800w, ${imageUrl(ref)} 1600w`;
}
