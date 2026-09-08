import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(readProjectFile('public/manifest.webmanifest'));
const dimensions = new Map([
  ['/favicon.svg', 64],
  ['/icon-192.svg', 192],
  ['/icon-512.svg', 512],
]);
const attributes = (tag) => Object.fromEntries(
  Array.from(tag.matchAll(/([\w-]+)="([^"]*)"/g), ([, name, value]) => [name, value]),
);
const icons = new Map(Array.from(dimensions, ([src]) => {
  const svg = readProjectFile(`public${src}`);
  return [src, {
    svg,
    root: attributes(svg.match(/<svg\b[^>]*>/)[0]),
    background: attributes(svg.match(/<rect\b[^>]*\/>/)[0]),
    paths: Array.from(svg.matchAll(/<path\b[^>]*\/>/g), ([tag]) => attributes(tag)),
  }];
}));

function vertices(path) {
  assert.match(path.d, /^M\d+ \d+(?: L\d+ \d+)+(?: Z)?$/);
  return Array.from(path.d.matchAll(/[ML](\d+) (\d+)/g), ([, x, y]) => [Number(x), Number(y)]);
}

test('manifest references existing SVG assets with matching dimensions and purposes', () => {
  assert.equal(manifest.theme_color, '#287b6f');
  assert.equal(manifest.icons.length, dimensions.size);
  assert.deepEqual(manifest.icons.map(({ src }) => src).sort(), Array.from(dimensions.keys()).sort());
  for (const entry of manifest.icons) {
    const icon = icons.get(entry.src);
    const size = dimensions.get(entry.src);
    assert.ok(icon, entry.src);
    assert.equal(entry.type, 'image/svg+xml');
    assert.equal(entry.sizes, entry.src === '/favicon.svg' ? 'any' : `${size}x${size}`);
    assert.equal(entry.purpose, entry.src === '/icon-512.svg' ? 'any maskable' : 'any');
    assert.equal(icon.root.width, String(size));
    assert.equal(icon.root.height, String(size));
  }
});

test('all icons share the same teal, white house and warm yellow check identity', () => {
  const reference = icons.get('/favicon.svg').paths;
  for (const { svg, root, background, paths } of icons.values()) {
    assert.equal(root.xmlns, 'http://www.w3.org/2000/svg');
    assert.equal(root.viewBox, '0 0 64 64');
    assert.equal(root.fill, 'none');
    assert.equal(background.fill, '#287b6f');
    assert.equal(paths.length, 2);
    assert.deepEqual(paths, reference);
    assert.equal(paths[0].stroke, '#fff');
    assert.equal(paths[1].stroke, '#f4c95d');
    for (const path of paths) {
      assert.equal(path['stroke-linecap'], 'round');
      assert.equal(path['stroke-linejoin'], 'round');
      assert.ok(Number(path['stroke-width']) > 0);
    }
    assert.deepEqual(vertices(paths[0]), [[16, 30], [32, 16], [48, 30], [44, 30], [44, 47], [20, 47], [20, 30]]);
    assert.ok(paths[0].d.endsWith(' Z'));
    assert.deepEqual(vertices(paths[1]), [[26, 36], [31, 41], [39, 33]]);
    assert.doesNotMatch(svg, /<(?:image|script|foreignObject|use)\b|\b(?:transform|opacity|fill-opacity|stroke-opacity)=/);
  }
});

test('regular tiles are rounded and maskable backgrounds are opaque and full bleed', () => {
  for (const [src, { background }] of icons) {
    assert.equal(background.width, '64');
    assert.equal(background.height, '64');
    assert.equal(Number(background.x ?? 0), 0);
    assert.equal(Number(background.y ?? 0), 0);
    if (src === '/icon-512.svg') {
      assert.equal(Number(background.rx ?? 0), 0);
      assert.equal(Number(background.ry ?? 0), 0);
    } else {
      assert.equal(background.rx, '14');
    }
  }
});

test('foreground strokes fit inside the central 80 percent maskable safe circle', () => {
  const safeRadius = 64 * 0.4;
  for (const entry of manifest.icons.filter(({ purpose }) => purpose.split(' ').includes('maskable'))) {
    for (const path of icons.get(entry.src).paths) {
      const strokeRadius = Number(path['stroke-width']) / 2;
      for (const [x, y] of vertices(path)) {
        assert.ok(Math.hypot(x - 32, y - 32) + strokeRadius <= safeRadius, `${entry.src}: ${x},${y}`);
      }
    }
  }
});

test('check mark strokes sit inside the house walls and below the roof', () => {
  const check = icons.get('/favicon.svg').paths[1];
  const radius = Number(check['stroke-width']) / 2;
  for (const [x, y] of vertices(check)) {
    assert.ok(x - radius > 20 + 1.75 && x + radius < 44 - 1.75);
    assert.ok(y - radius > 30 && y + radius < 47 - 1.75);
  }
});

test('root metadata explicitly advertises the SVG favicon and web manifest', () => {
  const layout = readProjectFile('app/layout.tsx');
  assert.match(layout, /manifest:\s*['"]\/manifest\.webmanifest['"]/);
  assert.match(layout, /icons:\s*\{\s*icon:\s*\{\s*url:\s*['"]\/favicon\.svg['"],\s*type:\s*['"]image\/svg\+xml['"],\s*sizes:\s*['"]any['"]/);
});
