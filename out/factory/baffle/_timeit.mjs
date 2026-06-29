const t0 = Date.now();
const { bake, CURRICULUM } = await import('./baker.js');
const t1 = Date.now();
console.log('import+module-eval:', (t1-t0), 'ms');

const tb0 = Date.now();
const a = bake({ seed: 7 });
const tb1 = Date.now();
console.log('bake#1:', (tb1-tb0), 'ms; levels=', a.pack.levels.length);

const tb2 = Date.now();
const b = bake({ seed: 7 });
const tb3 = Date.now();
console.log('bake#2:', (tb3-tb2), 'ms');
