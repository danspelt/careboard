'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, LayoutGrid, Maximize2, Minimize2, Plus, RotateCcw, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DASHBOARD_THEMES,
  addWidget,
  defaultLayout,
  moveWidget,
  removeWidget,
  setWidgetSize,
  widgetDef,
  widgetsForRole,
  type DashboardRole,
  type WidgetItem,
} from '@/lib/dashboard-widgets';

const controlButton =
  'grid size-9 shrink-0 place-items-center rounded-lg text-[#52645f] transition hover:bg-[#eef2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] disabled:opacity-40 disabled:hover:bg-transparent';

export function DashboardGrid({
  audience,
  items,
  themeId,
  renderWidget,
  onSaveLayout,
  onSaveTheme,
  busy,
}: {
  audience: DashboardRole;
  items: WidgetItem[];
  themeId: string;
  renderWidget: (id: string) => React.ReactNode;
  onSaveLayout: (layout: WidgetItem[]) => void;
  onSaveTheme: (themeId: string | null) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const catalog = widgetsForRole(audience);
  const missing = catalog.filter((widget) => !items.some((item) => item.id === widget.id));
  const categories = [...new Set(missing.map((widget) => widget.category))];
  const save = (layout: WidgetItem[]) => onSaveLayout(layout);
  const surprise = () => {
    const others = DASHBOARD_THEMES.filter((theme) => theme.id !== themeId);
    onSaveTheme(others[Math.floor(Math.random() * others.length)].id);
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        {editing && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => save(defaultLayout(audience))}>
            <RotateCcw className="size-4" aria-hidden="true" />Reset layout
          </Button>
        )}
        <Button type="button" size="sm" variant={editing ? 'default' : 'outline'} disabled={busy} onClick={() => setEditing((value) => !value)} className={editing ? 'bg-[#287b6f]' : ''} aria-pressed={editing}>
          {editing ? <><Check className="size-4" aria-hidden="true" />Done</> : <><LayoutGrid className="size-4" aria-hidden="true" />Customize</>}
        </Button>
      </div>

      {editing && (
        <div className="mb-5 space-y-5 rounded-2xl border border-dashed border-[#aac3b3] bg-[#f4f8f4] p-4">
          <section aria-label="Colour scheme">
            <h2 className="text-sm font-bold">Colour scheme</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {DASHBOARD_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.name}
                  aria-label={`${theme.name} colour scheme`}
                  aria-pressed={themeId === theme.id}
                  disabled={busy}
                  onClick={() => onSaveTheme(theme.id)}
                  className={`grid size-11 place-items-center rounded-full border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${themeId === theme.id ? 'border-[#20312d]' : 'border-white shadow-sm hover:scale-105'}`}
                  style={{ backgroundColor: theme.swatch }}
                >
                  {themeId === theme.id && <Check className="size-5 text-white" aria-hidden="true" />}
                </button>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={surprise}>
                <Shuffle className="size-4" aria-hidden="true" />Surprise me
              </Button>
            </div>
          </section>
          <section aria-label="Widget library">
            <h2 className="text-sm font-bold">Widget library</h2>
            {missing.length === 0 ? (
              <p className="mt-2 text-sm text-[#687873]">Every widget is on your dashboard. Remove one to see it here again.</p>
            ) : (
              categories.map((category) => (
                <div key={category} className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#687873]">{category}</p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {missing
                      .filter((widget) => widget.category === category)
                      .map((widget) => (
                        <li key={widget.id} className="flex items-center gap-3 rounded-xl border border-[#dfe5dc] bg-white p-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{widget.title}</span>
                            <span className="block text-xs leading-4 text-[#687873]">{widget.description}</span>
                          </span>
                          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => save(addWidget(items, audience, widget.id))} aria-label={`Add ${widget.title}`}>
                            <Plus className="size-4" aria-hidden="true" />Add
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {items.length === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-[#c6d2c8] bg-white/70 p-8 text-center">
          <LayoutGrid className="mx-auto size-8 text-[#687873]" aria-hidden="true" />
          <p className="mt-2 font-semibold">Your dashboard is empty</p>
          <p className="mt-1 text-sm text-[#687873]">Tap Customize to add widgets back.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {items.map((item, index) => {
            const def = widgetDef(item.id);
            const content = renderWidget(item.id);
            if (!editing && content === null) return null;
            return (
              <div key={item.id} className={item.size === 'full' ? 'md:col-span-2' : ''}>
                {editing && (
                  <div className="mb-2 flex items-center gap-1 rounded-xl border border-dashed border-[#aac3b3] bg-[#f4f8f4] px-2 py-1">
                    <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">{def?.title ?? item.id}</span>
                    <button type="button" className={controlButton} disabled={busy || index === 0} onClick={() => save(moveWidget(items, item.id, 'up'))} aria-label={`Move ${def?.title ?? item.id} up`}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className={controlButton} disabled={busy || index === items.length - 1} onClick={() => save(moveWidget(items, item.id, 'down'))} aria-label={`Move ${def?.title ?? item.id} down`}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className={controlButton} disabled={busy} onClick={() => save(setWidgetSize(items, item.id))} aria-label={item.size === 'full' ? `Make ${def?.title ?? item.id} half width` : `Make ${def?.title ?? item.id} full width`}>
                      {item.size === 'full' ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
                    </button>
                    <button type="button" className={controlButton} disabled={busy} onClick={() => save(removeWidget(items, item.id))} aria-label={`Remove ${def?.title ?? item.id}`}>
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {content ?? <div className="rounded-2xl border border-dashed border-[#dfe5dc] bg-white/70 p-5 text-sm text-[#687873]">This widget has nothing to show right now.</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
