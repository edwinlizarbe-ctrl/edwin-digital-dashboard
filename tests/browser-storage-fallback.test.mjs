import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('  const safeStorage = {');
const end = source.indexOf('\n  };', start);
assert.ok(start > -1 && end > start, 'safeStorage helper exists');
const declaration = source.slice(start, end + 5) + '\nthis.storage = safeStorage;';

function createStorage(localStorage) {
  const context = { window: {} };
  Object.defineProperty(context.window, 'localStorage', {
    get() {
      if (localStorage === null) throw new Error('SecurityError: storage disabled');
      return localStorage;
    },
  });
  vm.runInNewContext(declaration, context);
  return context.storage;
}

test('disabled browser storage does not crash preference reads or writes', () => {
  const storage = createStorage(null);
  assert.equal(storage.getItem('ed-theme-v3'), null);
  assert.equal(storage.setItem('ed-theme-v3', 'dark'), false);
  assert.equal(storage.removeItem('ed-theme-v3'), false);
});

test('normal browser storage retains preference behavior', () => {
  const values = new Map();
  const storage = createStorage({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  });
  assert.equal(storage.getItem('ed-theme-v3'), null);
  assert.equal(storage.setItem('ed-theme-v3', 'dark'), true);
  assert.equal(storage.getItem('ed-theme-v3'), 'dark');
  assert.equal(storage.removeItem('ed-theme-v3'), true);
  assert.equal(storage.getItem('ed-theme-v3'), null);
});

test('quota and privacy errors are contained', () => {
  const storage = createStorage({
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  });
  assert.equal(storage.getItem('ed-sidebar-v7'), null);
  assert.equal(storage.setItem('ed-sidebar-v7', 'navy'), false);
  assert.equal(storage.removeItem('ed-sidebar-v7'), false);
});

test('profile success requires persisted browser storage', () => {
  assert.match(source, /if\(!safeStorage\.setItem\('ed-profile-name:'\+state\.user\.id,fullName\)\)throw Error/);
  assert.match(source, /state\.profileSaved=false;[\s\S]*?No se pudo guardar el nombre en este navegador/);
});

test('company logo failure is surfaced instead of reporting success', () => {
  assert.match(source, /const logoStored=logo_data\?safeStorage\.setItem\(logoStoreKey\(\),logo_data\):safeStorage\.removeItem\(logoStoreKey\(\)\)/);
  assert.match(source, /if\(!logoStored\)throw Error\('El perfil se guardó, pero el navegador no pudo conservar el logotipo\.'\)/);
});

test('storage fallback remains scoped to browser preferences', () => {
  assert.doesNotMatch(source, /safeStorage\.setItem\('ed-session/);
  assert.doesNotMatch(source, /safeStorage\.setItem\('access_token/);
});
