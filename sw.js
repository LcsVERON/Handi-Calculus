/*
 * Service worker : garde tous les fichiers de l'appli dans le téléphone
 * pour qu'elle marche SANS connexion internet.
 *
 * Mises à jour (« stale-while-revalidate ») :
 *   - l'appli s'affiche TOUT DE SUITE avec les fichiers gardés en mémoire ;
 *   - en même temps, si internet marche, les fichiers sont re-téléchargés
 *     et la mémoire est mise à jour ;
 *   - la nouvelle version s'affiche donc à l'ouverture SUIVANTE.
 *
 * VERSION : plus obligatoire pour les petites mises à jour. L'augmenter
 * (v2 -> v3...) quand on supprime ou renomme un fichier : ça repart d'une
 * mémoire propre et efface l'ancienne.
 */
'use strict';

const VERSION = 'v2';
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
// cache: 'reload' = on les prend sur le serveur, pas dans le cache du navigateur.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return cache.addAll(FICHIERS.map(function (f) {
          return new Request(f, { cache: 'reload' });
        }));
      })
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

/**
 * Télécharge la dernière version d'un fichier et la range dans le cache.
 * cache: 'no-cache' = on demande toujours au serveur si le fichier a changé.
 * Renvoie la réponse du réseau (ou échoue si pas d'internet).
 */
function telechargerEtRanger(requete) {
  return fetch(requete, { cache: 'no-cache' }).then(function (reponse) {
    // On ne garde que les bonnes réponses de notre propre site.
    if (!reponse.ok || reponse.type !== 'basic' || reponse.redirected) return reponse;
    const copie = reponse.clone();
    return caches.open(CACHE)
      .then(function (cache) { return cache.put(requete, copie); })
      .then(function () { return reponse; });
  });
}

// Requêtes : réponse immédiate depuis le cache + mise à jour en arrière-plan.
// Seules les requêtes vers notre propre site sont concernées. Rien n'est envoyé ailleurs.
self.addEventListener('fetch', function (event) {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  const reseau = telechargerEtRanger(requete);
  // Laisse le temps à la mise à jour de finir, même si la page a déjà sa réponse.
  event.waitUntil(reseau.catch(function () { /* pas d'internet : rien à faire */ }));

  event.respondWith(
    caches.match(requete, { ignoreSearch: true }).then(function (enCache) {
      if (enCache) return enCache;
      // Pas encore en cache : on attend le réseau.
      return reseau.catch(function () {
        // Hors connexion et page inconnue : on montre l'appli.
        if (requete.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
