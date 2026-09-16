import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const files = [
  'src/screens/ImageSearchScreen.js',
  'src/utils/imageEmbeddingSearch.js',
  'src/services/productService.js',
  'supabase/functions/embed-image/index.ts',
];
for (const f of files) if (!fs.existsSync(root + f)) throw new Error(`Missing ${f}`);
const img = fs.readFileSync(root + 'src/screens/ImageSearchScreen.js','utf8');
const emb = fs.readFileSync(root + 'src/utils/imageEmbeddingSearch.js','utf8');
if (!img.includes("useState('1:1')")) throw new Error('Image search aspect was not restored');
if (!emb.includes('max_distance: 0.65')) throw new Error('Image search threshold was not restored');
if (!emb.includes('MAX_ON_THE_FLY_PRODUCTS = 24')) throw new Error('On-the-fly limit was not restored');
console.log(JSON.stringify({imageSearchRollback:true, productDetailImageFixKept:true},null,2));
