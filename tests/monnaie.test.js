// Tests de js/monnaie.js. Lancer avec :  node --test
// Aucune dépendance npm : seulement les modules intégrés à Node.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/monnaie.js');

/** Porte-monnaie à partir d'une liste courte : pm({2000: 1, 200: 1}). */
function pm(contenu) {
  return Object.assign(M.porteMonnaieVide(), contenu);
}

/** Vérifications communes à tout résultat non nul. */
function verifierCoherence(porte, prix, r) {
  let somme = 0;
  let nombre = 0;
  for (const [v, n] of Object.entries(r.donner)) {
    assert.ok(n > 0, 'pas de valeur à 0 dans donner');
    assert.ok(n <= porte[v], `on ne donne pas plus de ${v} que ce qu'on a`);
    somme += Number(v) * n;
    nombre += n;
  }
  assert.equal(r.somme, somme);
  assert.equal(r.nombre, nombre);
  assert.ok(r.somme >= prix);
  assert.equal(r.rendu, r.somme - prix);
}

test('4,99 € avec un billet de 5 € et beaucoup de centimes : le billet de 5 €', () => {
  const porte = pm({ 500: 1, 50: 5, 20: 5, 10: 10, 5: 10, 2: 10, 1: 10 });
  const r = M.choisir(porte, 499);
  assert.deepEqual(r.donner, { 500: 1 });
  assert.equal(r.rendu, 1);
  verifierCoherence(porte, 499, r);
});

test('12 € avec 20 + 10 + 2 : 10 + 2', () => {
  const porte = pm({ 2000: 1, 1000: 1, 200: 1 });
  const r = M.choisir(porte, 1200);
  assert.deepEqual(r.donner, { 1000: 1, 200: 1 });
  assert.equal(r.rendu, 0);
  verifierCoherence(porte, 1200, r);
});

test('37,40 € avec 20, 20, 50, trois pièces de 1 € et sept de 10 c : 20 + 20', () => {
  const porte = pm({ 2000: 2, 5000: 1, 100: 3, 10: 7 });
  const r = M.choisir(porte, 3740);
  assert.deepEqual(r.donner, { 2000: 2 });
  assert.equal(r.rendu, 260);
  verifierCoherence(porte, 3740, r);
});

test('total insuffisant : null', () => {
  assert.equal(M.choisir(pm({ 1000: 1, 200: 2 }), 1500), null);
  assert.equal(M.choisir(pm({ 1: 1 }), 2), null);
});

test('compte juste : rendu 0', () => {
  const porte = pm({ 500: 1, 200: 1, 50: 1 });
  const r = M.choisir(porte, 750);
  assert.deepEqual(r.donner, { 500: 1, 200: 1, 50: 1 });
  assert.equal(r.rendu, 0);
  verifierCoherence(porte, 750, r);
});

test('prix de 0,01 €', () => {
  const avecCentime = pm({ 1: 1, 500: 1 });
  assert.deepEqual(M.choisir(avecCentime, 1).donner, { 1: 1 });
  assert.equal(M.choisir(avecCentime, 1).rendu, 0);

  const seulementBillet = pm({ 500: 1 });
  const r = M.choisir(seulementBillet, 1);
  assert.deepEqual(r.donner, { 500: 1 });
  assert.equal(r.rendu, 499);
});

test('prix de 199,99 €', () => {
  // Avec un billet de 200 € : on le donne (1 objet, 1 centime rendu)
  // plutôt que 13 objets pour faire le compte juste.
  const porte = pm({ 20000: 1, 10000: 1, 5000: 1, 2000: 2, 500: 1, 200: 2, 50: 1, 20: 2, 5: 1, 2: 2 });
  const r = M.choisir(porte, 19999);
  assert.deepEqual(r.donner, { 20000: 1 });
  assert.equal(r.rendu, 1);
  verifierCoherence(porte, 19999, r);

  // Sans billet de 200 € : compte juste avec 13 objets.
  const sans = pm({ 10000: 1, 5000: 1, 2000: 2, 500: 1, 200: 2, 50: 1, 20: 2, 5: 1, 2: 2 });
  const r2 = M.choisir(sans, 19999);
  assert.equal(r2.rendu, 0);
  assert.equal(r2.nombre, 13);
  verifierCoherence(sans, 19999, r2);
});

test('porte-monnaie vide', () => {
  const vide = M.porteMonnaieVide();
  assert.equal(M.total(vide), 0);
  assert.equal(M.choisir(vide, 1), null);
  assert.equal(M.choisir(vide, 1200), null);
  assert.deepEqual(M.choisir(vide, 0), { donner: {}, somme: 0, rendu: 0, nombre: 0 });
});

test('prix invalide : erreur', () => {
  assert.throws(() => M.choisir(pm({ 500: 1 }), 4.99), RangeError);
  assert.throws(() => M.choisir(pm({ 500: 1 }), -1), RangeError);
});

test('préfère moins de rendu quand le nombre d’objets est proche', () => {
  // 3 € : une pièce de 2 € + une de 1 € (compte juste, 2 objets, score 2)
  // plutôt qu'un billet de 5 € (2 € rendus, 1 objet, score 3).
  const r = M.choisir(pm({ 500: 1, 200: 1, 100: 1 }), 300);
  assert.deepEqual(r.donner, { 200: 1, 100: 1 });
});

// --- Comparaison avec une recherche exhaustive -----------------------------

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function hasard(graine) {
  return function () {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Meilleur score possible en essayant toutes les combinaisons. */
function meilleurScoreExhaustif(porte, prix) {
  const valeurs = M.VALEURS.filter((v) => porte[v] > 0);
  let meilleur = Infinity;
  (function essayer(i, somme, nombre) {
    if (i === valeurs.length) {
      if (somme >= prix) meilleur = Math.min(meilleur, (somme - prix) + 100 * nombre);
      return;
    }
    for (let c = 0; c <= porte[valeurs[i]]; c++) {
      essayer(i + 1, somme + c * valeurs[i], nombre + c);
    }
  })(0, 0, 0);
  return meilleur;
}

test('le choix est toujours le meilleur (300 porte-monnaie au hasard)', () => {
  const alea = hasard(42);
  for (let essai = 0; essai < 300; essai++) {
    const porte = M.porteMonnaieVide();
    // 5 valeurs au hasard, 0 à 3 exemplaires chacune.
    for (let k = 0; k < 5; k++) {
      const v = M.VALEURS[Math.floor(alea() * M.VALEURS.length)];
      porte[v] = Math.floor(alea() * 4);
    }
    const T = M.total(porte);
    const prix = Math.floor(alea() * (T + 500));
    const r = M.choisir(porte, prix);
    const attendu = meilleurScoreExhaustif(porte, prix);
    if (attendu === Infinity) {
      assert.equal(r, null, `essai ${essai}`);
    } else {
      verifierCoherence(porte, prix, r);
      assert.equal((r.somme - prix) + 100 * r.nombre, attendu, `essai ${essai}`);
    }
  }
});

test('reste rapide avec un gros porte-monnaie', () => {
  const porte = M.porteMonnaieVide();
  M.VALEURS.forEach((v) => { porte[v] = 20; });
  const debut = Date.now();
  const r = M.choisir(porte, 123456);
  assert.ok(Date.now() - debut < 2000, 'moins de 2 secondes');
  verifierCoherence(porte, 123456, r);
});

// --- Outils d'affichage et de saisie ---------------------------------------

test('total et nettoyer', () => {
  assert.equal(M.total(pm({ 2000: 2, 5000: 1, 100: 3, 10: 7 })), 9370);
  const propre = M.nettoyer({ 500: '2', 200: -3, 100: 1.7, 50: 'abc', 999: 4, 1: 5000 });
  assert.equal(propre[500], 2);
  assert.equal(propre[200], 0);
  assert.equal(propre[100], 1);
  assert.equal(propre[50], 0);
  assert.equal(propre[999], undefined);
  assert.equal(propre[1], M.MAX_PAR_VALEUR);
  assert.deepEqual(M.nettoyer(null), M.porteMonnaieVide());
});

test('formaterEuros', () => {
  assert.equal(M.formaterEuros(0), '0 €');
  assert.equal(M.formaterEuros(5), '0,05 €');
  assert.equal(M.formaterEuros(499), '4,99 €');
  assert.equal(M.formaterEuros(500), '5 €');
  assert.equal(M.formaterEuros(3740), '37,40 €');
});

test('libellés et noms', () => {
  assert.equal(M.libelle(500), '5 €');
  assert.equal(M.libelle(50), '50 c');
  assert.equal(M.nomComplet(20000), 'billet de 200 euros');
  assert.equal(M.nomComplet(100), 'pièce de 1 euro');
  assert.equal(M.nomComplet(200), 'pièce de 2 euros');
  assert.equal(M.nomComplet(1), 'pièce de 1 centime');
  assert.equal(M.nomComplet(20), 'pièce de 20 centimes');
});

test('montantParle et phrases à écouter', () => {
  assert.equal(M.montantParle(499), '4 euros et 99 centimes');
  assert.equal(M.montantParle(100), '1 euro');
  assert.equal(M.montantParle(260), '2 euros et 60 centimes');
  assert.equal(M.montantParle(1), '1 centime');
  assert.equal(M.montantParle(101), '1 euro et 1 centime');

  const r = M.choisir(pm({ 2000: 2, 5000: 1, 100: 3, 10: 7 }), 3740);
  assert.equal(
    M.phraseOui(r),
    "Oui. Tu as assez d'argent. Donne : un billet de 20 euros, un billet de 20 euros. " +
      'Le vendeur te rend 2 euros et 60 centimes.'
  );
  const juste = M.choisir(pm({ 200: 1, 50: 1 }), 250);
  assert.equal(
    M.phraseOui(juste),
    "Oui. Tu as assez d'argent. Donne : une pièce de 2 euros, une pièce de 50 centimes. C'est le compte juste."
  );
  assert.equal(M.phraseNon(299), "Non. Tu n'as pas assez d'argent. Il manque 2 euros et 99 centimes.");
});

test('listeObjets', () => {
  assert.deepEqual(M.listeObjets({ 50: 1, 2000: 2 }), [2000, 2000, 50]);
  assert.deepEqual(M.listeObjets({}), []);
});

test('clavier du prix : taperTouche', () => {
  const taper = (touches) => touches.reduce(M.taperTouche, '');
  assert.equal(taper(['4', ',', '9', '9']), '4,99');
  assert.equal(taper(['4', ',', '9', '9', '9']), '4,99', '2 décimales au maximum');
  assert.equal(taper([',', '5']), '0,5');
  assert.equal(taper(['1', ',', ',', '2']), '1,2', 'une seule virgule');
  assert.equal(taper(['0', '0', '7']), '7', 'pas de zéro inutile devant');
  assert.equal(taper(['1', '2', 'effacer']), '1');
  assert.equal(taper(['effacer']), '');
  assert.equal(taper(['1', '2', '3', '4', '5', '6', '7']), '123456', '6 chiffres au maximum');
  assert.equal(taper(['9', '9', '9', '9', ',', '9', '9', '9']), '9999,99');
  assert.equal(taper(['x']), '');
});

test('prixEnCentimes', () => {
  assert.equal(M.prixEnCentimes(''), 0);
  assert.equal(M.prixEnCentimes('0,'), 0);
  assert.equal(M.prixEnCentimes('4,99'), 499);
  assert.equal(M.prixEnCentimes('0,5'), 50);
  assert.equal(M.prixEnCentimes('0,01'), 1);
  assert.equal(M.prixEnCentimes('12'), 1200);
  assert.equal(M.prixEnCentimes('199,99'), 19999);
  assert.equal(M.prixEnCentimes('37,4'), 3740);
});
