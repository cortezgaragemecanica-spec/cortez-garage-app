import {rm,mkdir,cp,copyFile,access} from 'node:fs/promises';
const required=['index.html','src/main.js','src/sync.js','src/delete-order.js','src/budget-order.js','src/pdf-order.js','src/stock.js','src/admin.js','src/audio-diagnosis.js','src/style.css','public/sw.js','public/manifest.webmanifest','public/official-logo.png','public/icons/icon-192.png','public/icons/icon-512.png'];
await Promise.all(required.map(file=>access(file)));
await rm('dist',{recursive:true,force:true});await mkdir('dist');
await Promise.all([copyFile('index.html','dist/index.html'),cp('src','dist/src',{recursive:true}),cp('public','dist',{recursive:true})]);
console.log('✓ Build concluído em dist/ (compatível com /cortez-garage-app/)');

