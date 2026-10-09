import { useCallback } from 'react';
import type { Product } from '../../shared/catalog';
import { applyContent, type AboutContent, type HomeContent, type ServiceEdit, type ShippingContent, type SiteEdit } from '../../shared/content';
import type { ServiceCategory } from '../../shared/services';
import { api } from '../lib/api';
import { useAdminData } from './kit';

export type ContentView = {
  site: SiteEdit;
  shipping: ShippingContent;
  home: HomeContent;
  about: AboutContent;
  shop: { enabled: boolean };
  services: (ServiceEdit & { id: string; category: ServiceCategory })[];
  products: Product[];
  edited: { site: boolean; shipping: boolean; home: boolean; about: boolean; services: string[]; products: boolean };
  builtinImages: string[];
  embed: string;
};

/** Loads the editable content; `save` sends a change and refreshes the site in this tab too. */
export function useContent() {
  const state = useAdminData<ContentView>('/admin/content');
  const { setData } = state;
  const apply = useCallback(
    (view: ContentView) => {
      setData(view);
      try {
        applyContent(JSON.parse(view.embed));
      } catch {
        // The public pages will pick it up on the next page load.
      }
      return view;
    },
    [setData],
  );
  const save = useCallback(
    async (path: string, body: unknown, method = 'PUT') => apply(await api<ContentView>(path, { method, body })),
    [apply],
  );
  const remove = useCallback(async (path: string) => apply(await api<ContentView>(path, { method: 'DELETE' })), [apply]);
  return { ...state, save, remove };
}
