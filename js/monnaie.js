/*
 * monnaie.js : logique pure de l'application (aucun accès au DOM).
 *
 * Tous les montants sont en CENTIMES ENTIERS (ex. 4,99 € = 499).
 * On ne fait jamais de calcul d'argent avec des nombres à virgule.
 *
 * Un porte-monnaie est un objet { valeurEnCentimes: nombre }, par exemple
 * { 2000: 1, 1000: 1, 200: 1 } = un billet de 20 €, un de 10 €, une pièce de 2 €.
 *
 * Ce fichier marche dans le navigateur (il crée window.Monnaie)
 * et dans Node (module.exports), sans étape de compilation.
 */
(function (racine, fabrique) {
  'use strict';
  const Monnaie = fabrique();
  if (typeof module === 'object' && module.exports) {
    module.exports = Monnaie;
  } else {
    racine.Monnaie = Monnaie;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Toutes les valeurs, de la plus grande à la plus petite. */
  const VALEURS = Object.freeze([20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]);
  /** Ordre d'affichage sur l'écran « Mon argent ». */
  const BILLETS = Object.freeze([500, 1000, 2000, 5000, 10000, 20000]);
  const PIECES_EUROS = Object.freeze([100, 200]);
  const PETITES_PIECES = Object.freeze([50, 20, 10, 5, 2, 1]);

  /** Nombre maximum d'exemplaires d'une même valeur (protège la mémoire). */
  const MAX_PAR_VALEUR = 999;
  /** Le prix a au maximum 6 chiffres (9999,99 € ou 999999 €), comme le prototype. */
  const MAX_CHIFFRES_PRIX = 6;

  function estBillet(valeur) {
    return valeur >= 500;
  }

  /** Porte-monnaie avec 0 de chaque valeur. */
  function porteMonnaieVide() {
    const pm = {};
    VALEURS.forEach(function (v) { pm[v] = 0; });
    return pm;
  }

  /**
   * Remet un porte-monnaie au propre : chaque valeur connue a un nombre
   * entier entre 0 et MAX_PAR_VALEUR. Les clés inconnues sont ignorées.
   * Sert aussi à relire ce qui est sauvegardé dans localStorage.
   */
  function nettoyer(source) {
    const pm = porteMonnaieVide();
    if (!source || typeof source !== 'object') return pm;
    VALEURS.forEach(function (v) {
      const n = Math.floor(Number(source[v]));
      pm[v] = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_PAR_VALEUR) : 0;
    });
    return pm;
  }

  /** Total du porte-monnaie, en centimes. */
  function total(source) {
    const pm = nettoyer(source);
    return VALEURS.reduce(function (somme, v) { return somme + v * pm[v]; }, 0);
  }

  /**
   * Choisit les billets et pièces à donner pour payer `prix` centimes.
   * (Équivalent de choose() dans docs/prototype.html.)
   *
   * Parmi tous les choix possibles dont la somme S est >= prix P, on garde
   * celui qui a le plus petit score :
   *     (S − P) / 100  +  nombre de billets et pièces donnés
   * Pour rester en entiers, on compare  (S − P) + 100 × nombre,
   * qui donne exactement le même classement.
   * En cas d'égalité, on garde la plus petite somme S (donc le moins de rendu).
   *
   * Méthode : programmation dynamique, une couche par valeur.
   *   cur[s] = nombre minimal d'objets pour faire exactement s centimes.
   *   couche[s] = combien d'exemplaires de cette valeur on a pris pour arriver à s.
   * Puis on remonte les couches pour retrouver la solution.
   *
   * Retourne null si le porte-monnaie ne suffit pas, sinon :
   *   { donner: { valeur: nombre }, somme, rendu, nombre }
   */
  function choisir(source, prix) {
    if (!Number.isInteger(prix) || prix < 0) {
      throw new RangeError('Le prix doit être un nombre entier de centimes, positif ou nul.');
    }
    const pm = nettoyer(source);
    const T = total(pm);
    if (T < prix) return null;

    // Limite utile : dans la meilleure solution, enlever n'importe quel objet
    // donné ferait passer la somme sous le prix (sinon on l'enlèverait et le
    // score baisserait). Donc S − P < plus petit objet donné <= plus grande
    // valeur présente. Inutile de calculer au-delà de P + plusGrande − 1.
    const plusGrande = VALEURS.find(function (v) { return pm[v] > 0; }) || 0;
    const limite = Math.min(T, prix + Math.max(plusGrande - 1, 0));

    const INF = 0x3fffffff;
    const couches = [];
    let cur = new Int32Array(limite + 1).fill(INF);
    cur[0] = 0;

    VALEURS.forEach(function (d) {
      const n = pm[d];
      const suivant = cur.slice();
      const couche = new Uint16Array(limite + 1);
      if (n > 0) {
        for (let s = 0; s <= limite; s++) {
          if (cur[s] >= INF) continue;
          for (let c = 1; c <= n && s + c * d <= limite; c++) {
            const v = cur[s] + c;
            if (v < suivant[s + c * d]) {
              suivant[s + c * d] = v;
              couche[s + c * d] = c;
            }
          }
        }
      }
      couches.push(couche);
      cur = suivant;
    });

    let meilleure = -1;
    let meilleurScore = Infinity;
    for (let s = prix; s <= limite; s++) {
      if (cur[s] >= INF) continue;
      const score = (s - prix) + 100 * cur[s];
      if (score < meilleurScore) {
        meilleurScore = score;
        meilleure = s;
      }
    }

    // Reconstruction : on part de la dernière couche et on remonte.
    const donner = {};
    let reste = meilleure;
    let nombre = 0;
    for (let i = VALEURS.length - 1; i >= 0; i--) {
      const c = couches[i][reste];
      if (c) {
        donner[VALEURS[i]] = c;
        reste -= c * VALEURS[i];
        nombre += c;
      }
    }

    return { donner: donner, somme: meilleure, rendu: meilleure - prix, nombre: nombre };
  }

  /**
   * Liste à plat des objets à donner, du plus grand au plus petit.
   * { 2000: 2, 50: 1 } -> [2000, 2000, 50]
   */
  function listeObjets(donner) {
    const liste = [];
    VALEURS.forEach(function (v) {
      for (let i = 0; i < (donner[v] || 0); i++) liste.push(v);
    });
    return liste;
  }

  /** 499 -> "4,99 €", 500 -> "5 €", 5 -> "0,05 €" (comme eur() du prototype). */
  function formaterEuros(centimes) {
    const e = Math.floor(centimes / 100);
    const r = centimes % 100;
    return r ? e + ',' + String(r).padStart(2, '0') + ' €' : e + ' €';
  }

  /** Petite étiquette d'une valeur : 500 -> "5 €", 50 -> "50 c". */
  function libelle(valeur) {
    return valeur >= 100 ? (valeur / 100) + ' €' : valeur + ' c';
  }

  /** Nom complet pour les lecteurs d'écran : "billet de 5 euros", "pièce de 1 euro". */
  function nomComplet(valeur) {
    if (estBillet(valeur)) return 'billet de ' + (valeur / 100) + ' euros';
    if (valeur >= 100) return 'pièce de ' + (valeur / 100) + (valeur > 100 ? ' euros' : ' euro');
    return 'pièce de ' + valeur + (valeur > 1 ? ' centimes' : ' centime');
  }

  /**
   * Montant à lire à voix haute, sans virgule (plus facile à comprendre) :
   * 499 -> "4 euros et 99 centimes", 100 -> "1 euro", 5 -> "5 centimes".
   */
  function montantParle(centimes) {
    const e = Math.floor(centimes / 100);
    const r = centimes % 100;
    const partE = e + (e > 1 ? ' euros' : ' euro');
    const partC = r + (r > 1 ? ' centimes' : ' centime');
    if (e && r) return partE + ' et ' + partC;
    if (r) return partC;
    return partE;
  }

  /** Texte lu par le bouton « Écouter » quand c'est OUI. */
  function phraseOui(resultat) {
    const objets = listeObjets(resultat.donner).map(function (v) {
      return (estBillet(v) ? 'un ' : 'une ') + nomComplet(v);
    });
    let texte = "Oui. Tu as assez d'argent. Donne : " + objets.join(', ') + '.';
    texte += resultat.rendu
      ? ' Le vendeur te rend ' + montantParle(resultat.rendu) + '.'
      : " C'est le compte juste.";
    return texte;
  }

  /** Texte lu par le bouton « Écouter » quand c'est NON. */
  function phraseNon(manque) {
    return "Non. Tu n'as pas assez d'argent. Il manque " + montantParle(manque) + '.';
  }

  /**
   * Clavier du prix : renvoie le nouveau texte après l'appui sur une touche.
   * Touches : "0" à "9", "," et "effacer". 2 chiffres après la virgule au maximum.
   */
  function taperTouche(texte, touche) {
    texte = texte || '';
    if (touche === 'effacer') return texte.slice(0, -1);
    if (touche === ',') {
      return texte.includes(',') ? texte : (texte || '0') + ',';
    }
    if (!/^[0-9]$/.test(touche)) return texte;
    const decimales = texte.split(',')[1];
    if (decimales !== undefined && decimales.length >= 2) return texte;
    if (texte === '0') texte = '';
    if (texte.replace(',', '').length >= MAX_CHIFFRES_PRIX) return texte;
    return texte + touche;
  }

  /** "4,99" -> 499, "12" -> 1200, "0,5" -> 50, "" -> 0. */
  function prixEnCentimes(texte) {
    if (!texte) return 0;
    const morceaux = texte.split(',');
    const euros = parseInt(morceaux[0] || '0', 10) || 0;
    const cent = parseInt(((morceaux[1] || '') + '00').slice(0, 2), 10) || 0;
    return euros * 100 + cent;
  }

  return Object.freeze({
    VALEURS: VALEURS,
    BILLETS: BILLETS,
    PIECES_EUROS: PIECES_EUROS,
    PETITES_PIECES: PETITES_PIECES,
    MAX_PAR_VALEUR: MAX_PAR_VALEUR,
    estBillet: estBillet,
    porteMonnaieVide: porteMonnaieVide,
    nettoyer: nettoyer,
    total: total,
    choisir: choisir,
    listeObjets: listeObjets,
    formaterEuros: formaterEuros,
    libelle: libelle,
    nomComplet: nomComplet,
    montantParle: montantParle,
    phraseOui: phraseOui,
    phraseNon: phraseNon,
    taperTouche: taperTouche,
    prixEnCentimes: prixEnCentimes
  });
});
