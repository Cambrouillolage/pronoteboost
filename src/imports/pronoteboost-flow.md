Flow global PronoteBoost
1. Découverte sans compte

L’utilisateur installe l’extension et arrive sur Pronote.

Dans le panneau de droite, il voit :

PronoteBoost
Gagne du temps sur tes appréciations.
Tu as 25 crédits offerts pour tester.

Boutons :

Générer une appréciation

Générer toute la classe

Petite ligne :

1 appréciation = 1 crédit

1 classe complète = nombre d’élèves détectés, plafonné selon ton choix

2. Utilisation gratuite sans compte

Tu peux autoriser l’usage sans inscription immédiate, mais avec une sécurité côté serveur.

Ce qu’il faut faire techniquement

Ne jamais gérer les 25 crédits uniquement dans l’extension.
Sinon l’utilisateur pourra tricher.

Il faut donc créer un visitor id dès la première ouverture :

l’extension génère un identifiant aléatoire unique

elle l’enregistre en local

elle envoie cet identifiant à ton backend à chaque requête

Exemple :

{
  "visitorId": "pb_9f4k2l8x7m",
  "studentName": "Maxime BOUET",
  "average": "14.5",
  "context": "ensemble sérieux, participation correcte"
}

Ton serveur garde :

le nombre de crédits consommés

la date de création

éventuellement l’IP / fingerprint léger en renfort

le statut : invité ou inscrit

Donc même sans compte, le vrai compteur est côté serveur.

3. Règle de crédits gratuits

Tu peux faire simple :

Option A — la plus claire

25 crédits offerts

1 appréciation = 1 crédit

une classe de 30 élèves consomme 30 crédits

si l’utilisateur n’a que 12 crédits, il peut seulement faire 12 appréciations

Option B — plus marketing

25 crédits, annoncés comme :

jusqu’à 1 classe test

ou plusieurs générations une à une

Je te conseille Option A, car elle est plus simple à comprendre et à coder.

4. Message de succès motivant

Quand une appréciation est générée, tu peux afficher :

Appréciation générée avec succès
Vous venez de gagner du temps sur votre correction.

Et après plusieurs générations :

Vous avez déjà économisé environ 1h20, profitez de votre temps libre.

Ton message
“2439 appréciations ont été remplies aujourd’hui”
est très bon comme preuve sociale. Je le mettrais en petit sous le bloc principal :

2 439 appréciations générées aujourd’hui avec PronoteBoost

5. Mur d’inscription au bon moment

Le bon moment pour forcer l’inscription n’est pas au début.
C’est quand l’utilisateur essaie de dépasser son quota gratuit.

Exemple

Il lui reste 0 crédit, il clique sur générer.

Tu affiches une modale :

Tu as utilisé tes 25 crédits offerts.
Crée ton compte pour continuer et retrouver tes crédits sur tous tes appareils.

Boutons :

Créer mon compte

J’ai déjà un compte

Flow d’inscription
6. Création de compte

Formulaire simple :

prénom

email

mot de passe

Bouton :

Créer mon compte

Puis :

création du compte en base

envoi d’un mail de vérification

Message :
Compte créé. Vérifie ton adresse email pour activer ton accès.

7. Vérification email

L’utilisateur clique dans le mail.

Ton backend :

vérifie le token

active le compte

rattache les crédits invités restants au compte si besoin

C’est important : si l’utilisateur avait encore 4 crédits invités, il ne doit pas les perdre.

8. Connexion dans l’extension

Dans le bandeau PronoteBoost :

email

mot de passe

bouton connexion

Une fois connecté :

l’extension récupère un token de session

toutes les requêtes passent avec ce token

le serveur sait quel compte consomme les crédits

Achat de tokens / crédits
9. Après inscription : achat de packs

Là tu peux vendre des packs très lisibles.

Exemple :

Pack 50 crédits

Pack 150 crédits

Pack 500 crédits

Ou plus parlant pour les profs :

1 classe

5 classes

20 classes

Comme ton usage est centré sur la classe, cette présentation est meilleure.

Exemple :

Pack Découverte : 1 classe

Pack Confort : 5 classes

Pack Trimestre : 20 classes

Mais techniquement, derrière, tout reste en crédits.

10. Consommation des crédits

Quand l’utilisateur clique sur Valider pour injecter l’appréciation dans Pronote :

soit tu débites au moment de la génération

soit tu débites au moment de la validation finale

Je te conseille :

Débit à la validation

Pourquoi :

l’utilisateur peut générer plusieurs versions

il ne paie que celle qu’il garde vraiment

Donc flow idéal :

clic sur générer

proposition d’un texte

utilisateur modifie si besoin

clic sur Valider dans Pronote

débit d’1 crédit

C’est beaucoup plus juste.

Anti-contournement sans compte
11. Comment éviter qu’un invité dépasse les 25 crédits

Il faut plusieurs couches :

Couche 1 — visitorId

L’extension crée un identifiant unique stocké localement.

Couche 2 — backend

Le backend refuse toute requête si :

usedCredits >= 25

Couche 3 — empreinte légère

Tu peux aussi stocker des signaux :

IP approximative

user agent

hash de navigateur

date de première utilisation

Pas pour bloquer agressivement, mais pour repérer les abus évidents.

Couche 4 — limitation de fréquence

Exemple :

max X générations par minute

max Y générations par heure pour un invité

Ça évite les scripts.

Couche 5 — fusion invité → compte

Quand un utilisateur s’inscrit, tu rattaches son visitorId à son compte.
Comme ça, il ne recrée pas un historique vierge juste en s’inscrivant.

Flow UX complet recommandé
État 1 — utilisateur non inscrit

Dans le panneau :

PronoteBoost
25 crédits offerts pour tester

Crédits restants : 18 / 25

Appréciations générées aujourd’hui : 2 439

Boutons :

Générer pour cet élève

Générer pour la classe

État 2 — génération

L’utilisateur clique sur un élève.

Tu affiches :

nom

moyenne

éventuellement observations détectées

bouton Générer

Résultat :

proposition d’appréciation

bouton Insérer dans Pronote

bouton Regénérer

bouton Copier

Le crédit n’est débité qu’au clic sur Insérer dans Pronote.

État 3 — fin des crédits gratuits

Message :

Tes 25 crédits offerts sont utilisés.
Crée ton compte pour continuer en quelques secondes.

Boutons :

Créer un compte

Se connecter

État 4 — utilisateur connecté sans pack

Message :
Ton compte est actif. Choisis un pack pour continuer.

Boutons :

Acheter 1 classe

Acheter 5 classes

Acheter 20 classes

État 5 — utilisateur connecté avec crédits

Affichage :

Crédits restants : 84

Compte vérifié

Historique de consommation

Ce que je te conseille pour ton wording
Texte d’accueil

Gagne du temps sur tes appréciations Pronote
25 crédits offerts pour tester PronoteBoost.

Preuve sociale

2 439 appréciations générées aujourd’hui

Succès

Appréciation prête.
Vous avez gagné du temps sur votre saisie.

ou plus impactant :

Vous venez de gagner quelques minutes.
À l’échelle d’une classe, cela représente vite plus d’1h de temps récupéré.

Mur de conversion

Tes crédits offerts sont terminés.
Crée ton compte pour continuer et acheter des crédits quand tu en as besoin.

Architecture logique
Côté extension

récupère les infos Pronote

affiche l’interface

stocke un visitorId

appelle ton API

injecte le texte validé dans Pronote

Côté backend

gère visiteurs et comptes

compte les crédits

refuse les dépassements

envoie les mails de vérification

gère les achats

appelle OpenAI

Côté base de données

Tables simples :

visitors

id

visitor_id

created_at

used_free_credits

last_seen_at

status

users

id

email

password_hash

is_verified

created_at

credit_wallets

id

user_id

balance

generations

id

visitor_id ou user_id

student_name

generated_text

validated

created_at

purchases

id

user_id

pack_name

credits_added

amount

created_at

Décision importante : quand débiter

Je te mets la meilleure règle :

Débit uniquement si validation

Générer : gratuit

Regénérer : gratuit mais limité

Insérer/valider : payant, 1 crédit

Avec une limite pour éviter l’abus :

max 3 générations gratuites par élève avant validation
ou

max 10 générations brouillon par jour en mode invité

Comme ça :

expérience fluide

sentiment d’équité

moins de frustration

Version ultra simple pour démarrer

Si tu veux lancer vite, fais ce MVP :

MVP

25 crédits invités sans compte

compteur géré côté serveur avec visitorId

1 validation = 1 crédit

quand crédits finis :

inscription

vérification mail

achat de crédits

extension connectée à ton backend

backend connecté à OpenAI

C’est déjà largement suffisant pour tester le marché.

Flow final résumé

L’utilisateur installe l’extension

Il reçoit 25 crédits gratuits sans compte

Il génère des appréciations

Le crédit est débité seulement quand il valide

Quand il n’a plus de crédits, il doit s’inscrire

Il vérifie son email

Il se connecte

Il achète des crédits

Il continue à utiliser PronoteBoost normalement

Je te recommande vraiment cette règle simple : “1 appréciation validée = 1 crédit”.
C’est le plus facile à expliquer, à vendre et à coder.

Je peux maintenant te faire le flow écran par écran, avec les textes exacts des boutons, modales et messages pour ton extension.

tu peux me faire le prompt ecran par ecran je vais l'envoyer un figma make

Parfait 👍 Je vais te faire des prompts prêts à coller dans Figma Make pour générer les écrans de l’extension PronoteBoost.

Je les structure écran par écran, avec le contexte UI, le contenu, et le style.

Important :
Figma Make fonctionne mieux si on précise type d’app, layout, composants, ton et UX.

Prompt Figma Make — Extension PronoteBoost
Contexte global (à envoyer en premier)

Prompt :

Créer l’interface d’une extension Chrome appelée PronoteBoost qui apparaît dans un panneau vertical à droite de l’écran (largeur 320px) intégré dans l’interface de Pronote.

Objectif de l’extension : aider les professeurs à générer automatiquement des appréciations d’élèves.

Style UI :

moderne

simple

très lisible pour enseignants

interface claire

inspiration Notion / Linear / Stripe

icônes minimalistes

coins arrondis

micro animations légères

Palette :

couleur principale : #396155

couleur accent : #ff981d

fond clair

boutons arrondis

Composants :

cartes

boutons primaires

compteur de crédits

champ texte

message de succès

modales

Layout :

header avec logo PronoteBoost

contenu vertical scrollable

footer minimal

Écran 1 — Accueil utilisateur (mode gratuit)

Prompt :

Créer l’écran d’accueil d’une extension Chrome PronoteBoost pour enseignants.

Le panneau fait 320px de large.

Structure :

Header :
Logo PronoteBoost
Titre : PronoteBoost

Bloc principal :
Titre :
Gagne du temps sur tes appréciations Pronote

Texte :
25 crédits offerts pour tester l’outil.

Bloc compteur :
Carte avec icône éclair ⚡

Texte :
Crédits restants
25 / 25

Bloc preuve sociale :
Texte discret :

2 439 appréciations générées aujourd’hui

Boutons :

Bouton principal :
Générer pour cet élève

Bouton secondaire :
Générer pour la classe

Footer discret :

1 appréciation validée = 1 crédit

Écran 2 — Génération d’appréciation

Prompt :

Créer l’écran de génération d’une appréciation d’élève dans l’extension PronoteBoost.

Layout vertical 320px.

Bloc élève :

Carte avec :

Nom élève :
Maxime Bouet

Moyenne :
14.5 / 20

Bloc texte généré :

Zone texte éditable avec une appréciation générée :

"Maxime fournit un travail sérieux et régulier. Sa participation en classe est satisfaisante et ses résultats sont encourageants. Il doit poursuivre ses efforts."

Boutons sous le texte :

Bouton principal :
Insérer dans Pronote

Bouton secondaire :
Regénérer

Bouton discret :
Copier

Bloc crédits :

Texte :
Cette validation utilisera 1 crédit

Écran 3 — Succès

Prompt :

Créer un écran de succès après insertion d’une appréciation dans Pronote.

Interface simple.

Icône succès :

✅

Titre :

Appréciation ajoutée dans Pronote

Message :

Vous venez de gagner du temps sur votre correction.

Bloc stat :

Carte :

Temps estimé gagné aujourd’hui
+12 minutes

Bouton :

Générer la suivante

Texte discret :

Crédits restants : 24

Écran 4 — Fin des crédits gratuits

Prompt :

Créer une modale dans l’extension PronoteBoost lorsque les crédits gratuits sont épuisés.

Style clair et engageant.

Icône :

⚡

Titre :

Tes crédits gratuits sont terminés

Texte :

Tu as utilisé tes 25 crédits offerts.

Crée ton compte pour continuer à générer des appréciations automatiquement.

Boutons :

Bouton principal :

Créer mon compte

Bouton secondaire :

J’ai déjà un compte

Texte discret :

Inscription gratuite, accès immédiat.

Écran 5 — Création de compte

Prompt :

Créer un écran d’inscription simple pour l’extension PronoteBoost.

Layout vertical 320px.

Titre :

Créer un compte

Champs :

Prénom

Email

Mot de passe

Bouton principal :

Créer mon compte

Texte sous bouton :

Un email de vérification vous sera envoyé.

Lien secondaire :

Déjà un compte ? Se connecter

Écran 6 — Email envoyé

Prompt :

Créer un écran de confirmation après inscription.

Icône :

📩

Titre :

Vérifie ton email

Texte :

Un email de confirmation vient d’être envoyé.

Clique sur le lien dans ce mail pour activer ton compte.

Bouton :

J’ai vérifié mon email

Lien :

Renvoyer l’email

Écran 7 — Achat de crédits

Prompt :

Créer un écran d’achat de crédits dans l’extension PronoteBoost.

Layout vertical.

Titre :

Choisir un pack

Trois cartes produits.

Carte 1 :

1 Classe

≈ 30 appréciations

Prix :
4,90 €

Bouton :
Acheter

Carte 2 (mise en avant) :

5 Classes

≈ 150 appréciations

Prix :
19 €

Badge :
Le plus populaire

Bouton :
Acheter

Carte 3 :

20 Classes

≈ 600 appréciations

Prix :
59 €

Bouton :
Acheter

Footer :

Paiement sécurisé

Écran 8 — Utilisateur connecté

Prompt :

Créer l’écran principal pour un utilisateur connecté dans l’extension PronoteBoost.

Header :

PronoteBoost

Bloc compte :

Carte utilisateur

Email :
prof@email.fr

Crédits restants :

84

Boutons :

Générer pour cet élève

Générer pour la classe

Lien discret :

Acheter des crédits