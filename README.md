
# DigiAlert - Plateforme de Gestion de Rendez-vous & Alertes

Bienvenue sur le dépôt de **DigiAlert**, une solution logicielle SaaS conçue pour les entreprises et praticiens indépendants. 
Ce projet gère la prise de rendez-vous, l'envoi de rappels automatiques (SMS/Email), les annulations intelligentes et un kiosque d'accueil patient via QR Code.

## Stack Technique
* **Frontend :** React.js (v19), ViteJS, Tailwind CSS, Lucide React (Icônes).
* **Backend :** C# ASP.NET Core Web API (.NET 10).
* **Base de données :** PostgreSQL (v15).
* **Infrastructure :** Docker & Docker Compose (Environnement de développement isolé avec Hot Reload).
* **Services Tiers :** API DigiSMS (Envoi SMS V1), API Brevo (Envoi Emails transactionnels).

---

## Démarrage Rapide (Environnement de Développement)

Le projet est entièrement "Dockerisé". Vous n'avez pas besoin d'installer Node.js, .NET ou PostgreSQL sur votre machine locale.

### Prérequis
* Installer [Docker Desktop](https://www.docker.com/products/docker-desktop/) et s'assurer qu'il est lancé.
* Installer [Git](https://git-scm.com/).

### 1. Lancer l'application
Clonez le dépôt, ouvrez un terminal à la racine du projet et tapez :
```bash
docker-compose up
```
Docker va télécharger les images, installer les dépendances `npm`, compiler le backend et lancer la base de données.
* Le Frontend sera accessible sur : `http://localhost:5173` (ou l'IP de votre réseau local).
* Le Backend tournera sur : `http://localhost:5294`.
* La base de données PostgreSQL est exposée sur le port `5434`.

### 2. Initialiser la Base de données (Migrations)
La première fois que vous lancez le projet, la base de données Docker est vide. Laissez le `docker-compose` tourner en fond, ouvrez un autre terminal dans le dossier `DigiAlert.Api` et lancez la migration :
```bash
dotnet ef database update --connection "Host=localhost;Port=5434;Database=digialert_db;Username=postgres;Password=superpassword"
```

---

## Architecture du Projet

### 1. Frontend (`/DigiAlert.Web`)
L'interface utilisateur est construite avec React et Vite.
* **Proxy et Kiosque :** Dans `vite.config.js`, l'option `host: true` est activée pour permettre l'accès depuis un réseau local (indispensable pour scanner le QR Code du Kiosque avec un smartphone). Le proxy redirige les requêtes `/api` vers le conteneur Backend.
* **Paramètres API :** La gestion des clés API (DigiSMS, Brevo) et du `Sender ID` se fait dans `src/pages/Parametres.jsx`.

### 2. Backend (`/DigiAlert.Api`)
* **Base de données :** Entity Framework Core est utilisé avec PostgreSQL.
* **Moteur d'envoi asynchrone (`CronEngineService.cs`) :** C'est le cœur du système d'alertes. Un `BackgroundService` tourne en boucle toutes les 30 secondes pour scruter les événements `PENDING`. S'il est l'heure, il déclenche l'envoi de SMS/Email et met à jour le statut en `SENT` ou `FAILED`.
* **Routage Intelligent :** Lors de l'annulation d'un événement (route `POST /api/Events/{id}/cancel`), si des messages ont déjà été envoyés, le système force la création d'un nouveau message de type `CANCELLATION` pour prévenir les patients concernés.

---

## Gestion des API (SMS & Email)

Le système est conçu pour être multitenant (SaaS) : chaque entreprise peut entrer ses propres clés d'API depuis l'interface web (onglet *Paramètres*).

### DigiSMS (SMS)
* L'intégration utilise l'API V1 de production (`POST https://apiservice.digi-sms.com/api/v1/public/sms/send`).
* **⚠️ Important concernant le Sender ID :** Les opérateurs locaux exigent que le `Sender ID` (ex: "CLINIQUE_X") soit autorisé (whitelisted) par le support de DigiSMS. Si le nom n'est pas autorisé, le message peut être refusé ou l'expéditeur forcé par défaut. Le code contient un fallback de sécurité ("DIGIALERT") si le client oublie de le renseigner.

### Brevo (Emails)
* L'intégration utilise la clé **API REST** de Brevo (qui commence par `xkeysib-...` et non la clé SMTP `xsmtpsib-...`).
* Assurez-vous que l'adresse email d'expédition de l'entrepise a été préalablement validée sur le tableau de bord Brevo.

---

## Sécurité & Bonnes Pratiques
* Un fichier `.gitignore` strict a été mis en place pour s'assurer qu'aucun fichier sensible (ex: `MDP.txt` contenant des clés API en dur) ne soit poussé sur GitHub (Protégé par le *Secret Scanning* de GitHub).
* Les mots de passe des utilisateurs sont hachés avec `BCrypt` avant d'être sauvegardés en base de données.

---

## Prochaines Étapes (Mise en Production)
Pour le déploiement sur un serveur cloud de production (VPS, AWS, Hostinger...) :
1. Créer un fichier `docker-compose.prod.yml`.
2. Créer un `Dockerfile` pour le frontend utilisant `Nginx` pour servir les fichiers statiques (après un `npm run build`).
3. Retirer les options `dotnet watch` du backend pour utiliser la version compilée (`dotnet publish`).
4. Utiliser des variables d'environnement sécurisées pour cacher les mots de passe PostgreSQL.

---
```
Projet initié et mené jusqu'à la V1 par Giovanni.
```