import {rm,mkdir,cp,copyFile,access} from 'node:fs/promises';
const required=['index.html','src/main.js','src/style.css','public/sw.js','public/manifest.webmanifest','public/icons/icon.svg','public/icons/logo-cortez-garage.svg'];
await Promise.all(required.map(file=>access(file)));
await rm('dist',{recursive:true,force:true});await mkdir('dist');
await Promise.all([copyFile('index.html','dist/index.html'),cp('src','dist/src',{recursive:true}),cp('public','dist',{recursive:true})]);
console.log('✓ Build concluído em dist/ (compatível com /cortez-garage-app/)');
