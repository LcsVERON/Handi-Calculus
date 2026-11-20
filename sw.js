/*
 * Service worker : garde tous les fichiers de l'appli dans le téléphone
 * pour qu'elle marche SANS connexion internet.
 *
 * IMPORTANT : quand tu modifies un fichier de l'appli, augmente VERSION
 * (v1 -> v2...). Sinon les téléphones garderont l'ancienne version.
 */
'use strict';

const VERSION = 'v1';
const CACHE = 'assez-argent-' + VERSION;

// Tous les fichiers nécessaires (chemins relatifs : marche aussi sur GitHub Pages).
const FICHIERS = [
  './',
  'index.html',
  'mentions-legales.html',
  'css/style.css',
  'js/monnaie.js',
  'js/app.js',
  'manifest.webmanifest',
  'fonts/AtkinsonHyperlegible-Regular.woff2',
  'fonts/AtkinsonHyperlegible-Bold.woff2',
  'fonts/OFL.txt',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png'
];

// Installation : on met tous les fichiers en cache.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FICHIERS); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Activation : on supprime les anciennes versions du cache.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(noms
          .filter(function (nom) { return nom.startsWith('assez-argent-') && nom !== CACHE; })
          .map(function (nom) { return caches.delete(nom); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Requêtes : d'abord le cache, sinon le réseau. Rien n'est envoyé ailleurs.
self.addEventListener('fetch', function (event) {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(requete, { ignoreSearch: true }).then(function (enCache) {
      if (enCache) return enCache;
      return fetch(requete).catch(function () {
        // Hors connexion et page inconnue : on montre l'appli.
        if (requete.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
