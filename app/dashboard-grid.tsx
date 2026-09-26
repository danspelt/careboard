'use client';

import { createElement, useState } from 'react';
import { ArrowDown, ArrowUp, Check, CheckCircle2, LayoutGrid, Maximize2, Minimize2, Plus, RotateCcw, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { widgetIcon } from '@/lib/widget-icons';
import {
  DASHBOARD_DENSITIES,
  DASHBOARD_RADII,
  DASHBOARD_THEMES,
  addWidget,
  defaultLayout,
  moveWidget,
  removeWidget,
  serializeAppearance,
  setWidgetSize,
  widgetDef,
  widgetsForRole,
  type AppearancePrefs,
  type DashboardDensity,
  type DashboardRadius,
  type DashboardRole,
  type WidgetItem,
} from '@/lib/dashboard-widgets';

const controlButton =
  'grid size-9 shrink-0 place-items-center rounded-[var(--dash-radius)] text-[#52645f] transition hover:bg-[var(--role-primary-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--role-primary)] disabled:opacity-40 disabled:hover:bg-transparent';

export function DashboardGrid({
  audience,
  items,
  appearance,
  renderWidget,
  onSaveLayout,
  onSaveAppearance,
  busy,
}: {
  audience: DashboardRole;
  items: WidgetItem[];
  appearance: AppearancePrefs;
  renderWidget: (id: string) => React.ReactNode;
  onSaveLayout: (layout: WidgetItem[]) => void;
  onSaveAppearance: (prefs: AppearancePrefs) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const catalog = widgetsForRole(audience);
  const active = new Set(items.map((item) => item.id));
  const categories = [...new Set(catalog.map((widget) => widget.category))];
  const save = (layout: WidgetItem[]) => onSaveLayout(layout);
  const savePrefs = (patch: Partial<AppearancePrefs>) => onSaveAppearance({ ...appearance, ...patch });
  const surprise = () => {
    const others = DASHBOARD_THEMES.filter((theme) => theme.id !== appearance.colorId);
    const next = others[Math.floor(Math.random() * others.length)] ?? DASHBOARD_THEMES[0]!;
    savePrefs({ colorId: next.id });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        {!editing && <p className="mr-auto hidden text-xs text-[#8a9a92] sm:block">Customize colour, spacing, and which cards show — start with a clear first glance.</p>}
        {editing && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => save(defaultLayout(audience))}>
            <RotateCcw className="size-4" aria-hidden="true" />Reset layout
          </Button>
        )}
        <Button type="button" size={editing ? 'sm' : 'default'} variant={editing ? 'default' : 'outline'} disabled={busy} onClick={() => setEditing((value) => !value)} className={`min-h-11 ${editing ? 'bg-[var(--role-primary)]' : 'border-[var(--role-primary-soft)] bg-white font-semibold text-[var(--role-primary)]'}`} aria-pressed={editing}>
          {editing ? <><Check className="size-4" aria-hidden="true" />Done</> : <><LayoutGrid className="size-4" aria-hidden="true" />Customize look</>}
        </Button>
      </div>

      {editing && (
        <div className="mb-5 space-y-5 rounded-[var(--dash-radius-lg)] border border-dashed border-[var(--role-primary-soft)] bg-[var(--role-primary-light)]/60 p-4">
          <section aria-label="Colour scheme">
            <h2 className="text-sm font-bold">Colour</h2>
            <p className="mt-1 text-xs text-[#687873]">Applies across the hero, nav accents, and cards on this dashboard.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {DASHBOARD_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.name}
                  aria-label={`${theme.name} colour scheme`}
                  aria-pressed={appearance.colorId === theme.id}
                  disabled={busy}
                  onClick={() => savePrefs({ colorId: theme.id })}
                  className={`grid size-11 place-items-center rounded-full border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--role-primary)] ${appearance.colorId === theme.id ? 'border-[#20312d]' : 'border-white shadow-sm hover:scale-105'}`}
                  style={{ backgroundColor: theme.swatch }}
                >
                  {appearance.colorId === theme.id && <Check className="size-5 text-white" aria-hidden="true" />}
                </button>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={surprise}>
                <Shuffle className="size-4" aria-hidden="true" />Surprise me
              </Button>
            </div>
            <p className="mt-2 text-xs font-semibold text-[var(--role-primary)]">{DASHBOARD_THEMES.find((theme) => theme.id === appearance.colorId)?.name}</p>
          </section>

          <section aria-label="Spacing density">
            <h2 className="text-sm font-bold">Spacing</h2>
            <p className="mt-1 text-xs text-[#687873]">How tight or open the whole dashboard feels.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DASHBOARD_DENSITIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={appearance.density === option.id}
                  onClick={() => savePrefs({ density: option.id as DashboardDensity })}
                  className={`rounded-[var(--dash-radius)] border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--role-primary)] ${appearance.density === option.id ? 'border-[var(--role-primary)] bg-white shadow-sm' : 'border-[#dfe5dc] bg-white/70 hover:border-[var(--role-primary-soft)]'}`}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-4 text-[#687873]">{option.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section aria-label="Corner sizing">
            <h2 className="text-sm font-bold">Corners</h2>
            <p className="mt-1 text-xs text-[#687873]">Shape of heroes, cards, and controls.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DASHBOARD_RADII.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={appearance.radius === option.id}
                  onClick={() => savePrefs({ radius: option.id as DashboardRadius })}
                  className={`border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--role-primary)] ${appearance.radius === option.id ? 'border-[var(--role-primary)] bg-white shadow-sm' : 'border-[#dfe5dc] bg-white/70 hover:border-[var(--role-primary-soft)]'} ${option.id === 'sharp' ? 'rounded-md' : option.id === 'round' ? 'rounded-3xl' : 'rounded-2xl'}`}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-4 text-[#687873]">{option.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section aria-label="Widget library">
            <h2 className="text-sm font-bold">Widgets</h2>
            <p className="mt-1 text-xs text-[#687873]">{active.size} of {catalog.length} on your board · Half / Full sizes below each card</p>
            {categories.map((category) => (
              <div key={category} className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#687873]">{category}</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {catalog
                    .filter((widget) => widget.category === category)
                    .map((widget) => {
                      const Icon = widgetIcon(widget.id);
                      const onDashboard = active.has(widget.id);
                      return (
                        <li key={widget.id} className={`flex items-center gap-3 rounded-[var(--dash-radius)] border p-3 ${onDashboard ? 'border-[var(--role-primary-soft)] bg-white' : 'border-[#dfe5dc] bg-white/80'}`}>
                          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${onDashboard ? 'bg-[var(--role-primary)] text-white' : 'bg-[var(--role-primary-light)] text-[var(--role-primary)]'}`}>
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{widget.title}</span>
                            <span className="block text-xs leading-4 text-[#687873]">{widget.description}</span>
                          </span>
                          {onDashboard ? (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--role-primary)]" aria-label={`${widget.title} is on your dashboard`}>
                              <CheckCircle2 className="size-4" aria-hidden="true" />Added
                            </span>
                          ) : (
                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => save(addWidget(items, audience, widget.id))} aria-label={`Add ${widget.title}`}>
                              <Plus className="size-4" aria-hidden="true" />Add
                            </Button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </section>
          <p className="text-[11px] text-[#687873]">Saved as {serializeAppearance(appearance)} · colour, spacing, and corners travel with your account</p>
        </div>
      )}

      {items.length === 0 && !editing ? (
        <div className="rounded-[var(--dash-radius-lg)] border border-dashed border-[#c6d2c8] bg-white/70 p-8 text-center">
          <LayoutGrid className="mx-auto size-8 text-[#687873]" aria-hidden="true" />
          <p className="mt-2 font-semibold">Your dashboard is empty</p>
          <p className="mt-1 text-sm text-[#687873]">Tap Customize look to add widgets back.</p>
        </div>
      ) : (
        <div className="dashboard-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" style={{ gap: 'var(--dash-gap)' }}>
          {items.map((item, index) => {
            const def = widgetDef(item.id);
            const content = renderWidget(item.id);
            if (!editing && content === null) return null;
            return (
              <div key={item.id} className={item.size === 'full' ? 'md:col-span-2 xl:col-span-3 2xl:col-span-4' : ''}>
                {editing && (
                  <div className="mb-2 flex flex-wrap items-center gap-1 rounded-[var(--dash-radius)] border border-dashed border-[var(--role-primary-soft)] bg-[var(--role-primary-light)]/70 px-2 py-1">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-[var(--role-primary)]">
                      {createElement(widgetIcon(item.id), { className: 'size-3.5', 'aria-hidden': true })}
                    </span>
                    <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{def?.title ?? item.id}</span>
                    <fieldset className="m-0 flex items-center gap-1 rounded-lg border-0 bg-white/80 p-0.5">
                      <legend className="sr-only">Width for {def?.title ?? item.id}</legend>
                      <button
                        type="button"
                        className={`${controlButton} !size-8 text-[10px] font-bold ${item.size === 'half' ? 'bg-[var(--role-primary)] text-white hover:bg-[var(--role-primary)]' : ''}`}
                        disabled={busy}
                        aria-pressed={item.size === 'half'}
                        onClick={() => save(setWidgetSize(items, item.id, 'half'))}
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        className={`${controlButton} !size-8 text-[10px] font-bold ${item.size === 'full' ? 'bg-[var(--role-primary)] text-white hover:bg-[var(--role-primary)]' : ''}`}
                        disabled={busy}
                        aria-pressed={item.size === 'full'}
                        onClick={() => save(setWidgetSize(items, item.id, 'full'))}
                      >
                        Full
                      </button>
                    </fieldset>
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
                {content ?? <div className="rounded-[var(--dash-radius-lg)] border border-dashed border-[#dfe5dc] bg-white/70 p-5 text-sm text-[#687873]">This widget has nothing to show right now.</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
