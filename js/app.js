/*
 * app.js : l'interface (les 3 écrans). Les calculs sont dans monnaie.js.
 * Référence : docs/prototype.html
 */
(function () {
  'use strict';

  const M = window.Monnaie;
  const CLE_SAUVEGARDE = 'wallet';
  const DEBIT_VOIX = 0.85;

  // Couleurs des vrais billets en euros.
  const COULEUR_BILLET = {
    500: '#8e9196', 1000: '#d2463c', 2000: '#3b6fc4',
    5000: '#e98a2b', 10000: '#3d9a5b', 20000: '#d9b52c'
  };
  // Rayon des pièces (proportions proches des vraies pièces).
  const RAYON_PIECE = { 200: 40, 100: 37, 50: 38, 20: 35, 10: 31, 5: 34, 2: 30, 1: 26 };
  const POLICE_SVG = 'Atkinson Hyperlegible, Verdana, sans-serif';

  const $ = function (id) { return document.getElementById(id); };
  const ecrans = [$('v1'), $('v2'), $('v3')];
  const etapes = [$('s1'), $('s2'), $('s3')];
  const titres = [$('t1'), $('t2')];
  const barre = $('bar');

  // ---------------------------------------------------------------- État
  let porte = chargerPorteMonnaie();
  let prixTexte = '';
  let ecran = 1;
  let texteALire = '';
  let confirmerVider = false;

  function chargerPorteMonnaie() {
    try {
      return M.nettoyer(JSON.parse(localStorage.getItem(CLE_SAUVEGARDE) || 'null'));
    } catch (e) {
      return M.porteMonnaieVide();
    }
  }

  function sauverPorteMonnaie() {
    try {
      localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(porte));
    } catch (e) {
      // Stockage indisponible (navigation privée...) : l'appli marche quand même.
    }
  }

  // ---------------------------------------------------------------- Dessins
  /** Dessin SVG d'un billet ou d'une pièce. `echelle` change la taille. */
  function dessin(valeur, echelle) {
    echelle = echelle || 1;
    const nom = M.nomComplet(valeur);

    if (M.estBillet(valeur)) {
      const W = Math.round(150 * echelle);
      const H = Math.round(78 * echelle);
      const c = COULEUR_BILLET[valeur];
      // 100 et 200 : chiffres un peu plus petits pour ne pas toucher le rond « € ».
      const taille = valeur >= 10000 ? 33 : 40;
      return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 150 78" role="img" aria-label="' + nom + '">' +
        '<rect x="2" y="2" width="146" height="74" rx="8" fill="' + c + '"/>' +
        '<rect x="2" y="2" width="146" height="74" rx="8" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/>' +
        '<circle cx="118" cy="39" r="22" fill="rgba(255,255,255,.28)"/>' +
        '<text x="' + (valeur >= 10000 ? 12 : 16) + '" y="' + (valeur >= 10000 ? 51 : 54) + '" font-family="' + POLICE_SVG + '" font-weight="700" font-size="' + taille + '" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1">' + (valeur / 100) + '</text>' +
        '<text x="118" y="49" text-anchor="middle" font-family="' + POLICE_SVG + '" font-weight="700" font-size="28" fill="#fff">€</text>' +
        '</svg>';
    }

    const r = RAYON_PIECE[valeur] * echelle;
    const S = 2 * r + 6;
    const cx = S / 2;
    let interieur;
    if (valeur === 200) {        // 2 € : cœur doré, couronne argentée
      interieur = cercle(cx, r, '#c9ccd1') + cercle(cx, r * 0.7, '#d9b44a');
    } else if (valeur === 100) { // 1 € : cœur argenté, couronne dorée
      interieur = cercle(cx, r, '#d9b44a') + cercle(cx, r * 0.7, '#c9ccd1');
    } else if (valeur >= 10) {   // 10, 20, 50 c : jaune doré
      interieur = cercle(cx, r, '#e0b84e');
    } else {                     // 1, 2, 5 c : cuivre
      interieur = cercle(cx, r, '#b8693a');
    }
    const t = valeur >= 100 ? (valeur / 100) + '€' : valeur + 'c';
    const fs = Math.max(20, r * (t.length > 2 ? 0.62 : 0.78));
    return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + nom + '">' +
      interieur +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2.5"/>' +
      '<text x="' + cx + '" y="' + (cx + fs * 0.36) + '" text-anchor="middle" font-family="' + POLICE_SVG + '" font-weight="700" font-size="' + fs + '" fill="#1b1b1b">' + t + '</text>' +
      '</svg>';
  }

  function cercle(cx, r, couleur) {
    return '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="' + couleur + '"/>';
  }

  // ---------------------------------------------------------------- Écran 1 : Mon argent
  function case_(valeur) {
    return '<div class="cell">' +
      '<span class="badge" id="b' + valeur + '" aria-hidden="true"></span>' +
      '<button type="button" class="add" data-add="' + valeur + '">' + dessin(valeur, M.estBillet(valeur) ? 0.95 : 1) + '</button>' +
      '<button type="button" class="minus" data-min="' + valeur + '" aria-label="Enlever un ' + M.nomComplet(valeur) + '">−</button>' +
      '</div>';
  }

  $('gN').innerHTML = M.BILLETS.map(case_).join('');
  $('gE').innerHTML = M.PIECES_EUROS.map(case_).join('');
  $('gC').innerHTML = M.PETITES_PIECES.map(case_).join('');

  function afficherPorteMonnaie() {
    M.VALEURS.forEach(function (v) {
      const n = porte[v];
      const badge = $('b' + v);
      badge.textContent = '×' + n;
      badge.classList.toggle('show', n > 0);
      document.querySelector('[data-min="' + v + '"]').disabled = n === 0;
      document.querySelector('[data-add="' + v + '"]').setAttribute(
        'aria-label', 'Ajouter un ' + M.nomComplet(v) + '. Tu en as ' + n + '.'
      );
    });
    $('tot').textContent = M.formaterEuros(M.total(porte));
    sauverPorteMonnaie();
  }

  document.addEventListener('click', function (e) {
    const plus = e.target.closest('[data-add]');
    const moins = e.target.closest('[data-min]');
    if (plus) {
      const v = Number(plus.dataset.add);
      if (porte[v] < M.MAX_PAR_VALEUR) porte[v]++;
    } else if (moins) {
      const v = Number(moins.dataset.min);
      if (porte[v] > 0) porte[v]--;
    } else {
      return;
    }
    confirmerVider = false; // toucher l'argent annule la question « Tu veux tout enlever ? »
    afficherPorteMonnaie();
    afficherBarre();
  });

  // ---------------------------------------------------------------- Écran 2 : Le prix
  const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'effacer'];
  $('pad').innerHTML = TOUCHES.map(function (k) {
    const texte = k === 'effacer' ? '⌫' : k;
    const nom = k === 'effacer' ? 'Effacer' : (k === ',' ? 'Virgule' : k);
    return '<button type="button" data-k="' + k + '" aria-label="' + nom + '">' + texte + '</button>';
  }).join('');

  function taper(touche) {
    prixTexte = M.taperTouche(prixTexte, touche);
    afficherPrix();
  }

  $('pad').addEventListener('click', function (e) {
    const b = e.target.closest('[data-k]');
    if (b) taper(b.dataset.k);
  });

  // Clavier physique (pratique pour tester sur ordinateur).
  document.addEventListener('keydown', function (e) {
    if (ecran !== 2 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) taper(e.key);
    else if (e.key === ',' || e.key === '.') taper(',');
    else if (e.key === 'Backspace') taper('effacer');
    else if (e.key === 'Enter' && M.prixEnCentimes(prixTexte) > 0) montrer(3);
    else return;
    e.preventDefault();
  });

  function afficherPrix() {
    $('pr').innerHTML = (prixTexte || '0') + ' <small>€</small>';
    afficherBarre();
  }

  // ---------------------------------------------------------------- Écran 3 : Réponse
  function afficherReponse() {
    const prix = M.prixEnCentimes(prixTexte);
    const r = M.choisir(porte, prix);
    let html;

    if (!r) {
      const manque = prix - M.total(porte);
      texteALire = M.phraseNon(manque);
      html =
        '<div class="answer no">' +
          '<div class="sign" aria-hidden="true">✗</div>' +
          '<h1 id="t3" tabindex="-1">NON</h1>' +
          '<p>Tu n\'as pas assez d\'argent.</p>' +
          '<p>Il manque : <b>' + M.formaterEuros(manque) + '</b></p>' +
          boutonEcouter() +
        '</div>';
    } else {
      texteALire = M.phraseOui(r);
      const objets = M.listeObjets(r.donner);
      html =
        '<div class="answer yes">' +
          '<div class="sign" aria-hidden="true">✓</div>' +
          '<h1 id="t3" tabindex="-1">OUI</h1>' +
          '<p>Tu as assez d\'argent.</p>' +
          boutonEcouter() +
        '</div>' +
        '<h2 class="sec">Donne au vendeur :</h2>' +
        '<div class="give" role="list">' +
          objets.map(function (v) {
            return '<span role="listitem">' + dessin(v, M.estBillet(v) ? 0.8 : 0.9) + '</span>';
          }).join('') +
        '</div>' +
        '<p class="back-money">' +
          (r.rendu
            ? 'Le vendeur te rend : <b>' + M.formaterEuros(r.rendu) + '</b>'
            : 'C\'est le compte juste.') +
        '</p>';
    }
    $('res').innerHTML = html;
  }

  function boutonEcouter() {
    if (!('speechSynthesis' in window)) return '';
    return '<button type="button" class="say" id="say" aria-label="Écouter la réponse">🔊 Écouter</button>';
  }

  function voixFrancaise() {
    try {
      const voix = speechSynthesis.getVoices();
      return voix.find(function (v) { return v.lang === 'fr-FR'; }) ||
        voix.find(function (v) { return /^fr/i.test(v.lang); }) || null;
    } catch (e) {
      return null;
    }
  }

  function lire(texte) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.rate = DEBIT_VOIX;
      const v = voixFrancaise();
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {
      // Pas de synthèse vocale : on ne fait rien.
    }
  }

  function arreterLecture() {
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* rien */ }
  }

  $('res').addEventListener('click', function (e) {
    if (e.target.closest('#say')) lire(texteALire);
  });

  // ---------------------------------------------------------------- Barre du bas
  function afficherBarre() {
    barre.classList.toggle('ask', confirmerVider);
    if (ecran === 1 && confirmerVider) {
      // Confirmation avant de tout enlever. « Non » est le gros bouton (choix sans risque).
      barre.innerHTML =
        '<p class="question" id="q-vider">Tu veux tout enlever ?</p>' +
        '<button type="button" class="ghost" id="clr-oui" aria-describedby="q-vider">✓ Oui</button>' +
        '<button type="button" class="big" id="clr-non" aria-describedby="q-vider">✗ Non</button>';
      $('clr-non').focus();
    } else if (ecran === 1) {
      const vide = M.total(porte) === 0;
      barre.innerHTML =
        '<button type="button" class="ghost" id="clr" aria-label="Vider le porte-monnaie"' + (vide ? ' disabled' : '') + '>Vider</button>' +
        '<button type="button" class="big" id="go" aria-label="Suivant : écrire le prix"' + (vide ? ' disabled' : '') + '>Suivant →</button>';
    } else if (ecran === 2) {
      barre.innerHTML =
        '<button type="button" class="ghost arrow" id="back" aria-label="Retour à mon argent">←</button>' +
        '<button type="button" class="big" id="go" aria-label="Vérifier si j\'ai assez d\'argent"' + (M.prixEnCentimes(prixTexte) ? '' : ' disabled') + '>Vérifier</button>';
    } else {
      barre.innerHTML =
        '<button type="button" class="ghost arrow" id="back" aria-label="Retour au prix">←</button>' +
        '<button type="button" class="big" id="go" aria-label="Écrire un nouveau prix">Nouveau prix</button>';
    }
  }

  barre.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.id === 'clr') {
      confirmerVider = true;
      afficherBarre();
    } else if (b.id === 'clr-oui') {
      confirmerVider = false;
      porte = M.porteMonnaieVide();
      afficherPorteMonnaie();
      afficherBarre();
      $('t1').focus();
    } else if (b.id === 'clr-non') {
      confirmerVider = false;
      afficherBarre();
      $('t1').focus();
    } else if (b.id === 'go') {
      if (ecran === 1) montrer(2);
      else if (ecran === 2) montrer(3);
      else { prixTexte = ''; afficherPrix(); montrer(2); }
    } else if (b.id === 'back') {
      montrer(ecran - 1);
    }
  });

  // ---------------------------------------------------------------- Navigation
  function montrer(n) {
    ecran = n;
    confirmerVider = false;
    arreterLecture();
    ecrans.forEach(function (v, i) { v.classList.toggle('hide', i + 1 !== n); });
    etapes.forEach(function (s, i) {
      s.classList.toggle('on', i + 1 === n);
      if (i + 1 === n) s.setAttribute('aria-current', 'step');
      else s.removeAttribute('aria-current');
    });
    if (n === 3) afficherReponse();
    afficherBarre();
    window.scrollTo(0, 0);
    // Place le focus sur le titre pour les lecteurs d'écran.
    const titre = n === 3 ? $('t3') : titres[n - 1];
    if (titre) titre.focus({ preventScroll: true });
  }

  afficherPorteMonnaie();
  afficherPrix();
  montrer(1);

  // ---------------------------------------------------------------- Hors connexion
  // Le service worker garde l'appli dans le téléphone (il ne marche qu'en http/https).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Pas grave : l'appli marche quand même avec une connexion.
      });
    });
  }
})();
