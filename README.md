# 🏥 DigiAlert - Plateforme de Gestion de Rendez-vous & Alertes

Bienvenue sur le dépôt de **DigiAlert**, une solution logicielle SaaS conçue pour les entreprises et praticiens indépendants. 
Ce projet gère la prise de rendez-vous, l'envoi de rappels automatiques (SMS/Email), les annulations intelligentes et un kiosque d'accueil patient via QR Code.

## 🛠️ Stack Technique
* **Frontend :** React.js (v19), ViteJS, Tailwind CSS, Lucide React (Icônes).
* **Backend :** C# ASP.NET Core Web API (.NET 10).
* **Base de données :** PostgreSQL (v15).
* **Infrastructure :** Docker & Docker Compose (Environnement de développement isolé avec Hot Reload).
* **Services Tiers :** API DigiSMS (Envoi SMS V1), API Brevo (Envoi Emails transactionnels).

---

## 🚀 Démarrage Rapide (Environnement de Développement)

Le projet est entièrement "Dockerisé". Vous n'avez pas besoin d'installer Node.js, .NET ou PostgreSQL sur votre machine locale, Docker s'occupe de tout !

### Prérequis
* Installer [Docker Desktop](https://www.docker.com/products/docker-desktop/) et s'assurer qu'il est lancé.
* Installer [Git](https://git-scm.com/).

### 1. Cloner et Configurer
Clonez le dépôt sur votre machine, puis configurez vos variables d'environnement :
```bash
git clone <URL_DU_DEPOT>
cd DigiAlert
```
Dupliquez le fichier `.env.example` et renommez-le en `.env`. Remplissez-le avec vos clés API locales de développement.

### 2. Lancer l'application
Ouvrez un terminal à la racine du projet et tapez :
```bash
docker-compose up -d --build
```
Docker va télécharger les images, installer les dépendances `npm`, compiler le backend et lancer la base de données.
* 🌐 **Frontend :** `http://localhost:5173` (ou l'IP de votre réseau local).
* ⚙️ **Backend (Swagger API) :** `http://localhost:5294/swagger`.
* 🗄️ **Base de données :** Exposée sur le port `5434`.

### 3. Initialiser la Base de données (Migrations)
La première fois que vous lancez le projet, la base de données Docker est vide. Laissez les conteneurs tourner, ouvrez un autre terminal dans le dossier `DigiAlert.Api` et lancez la migration :
```bash
dotnet ef database update --connection "Host=localhost;Port=5434;Database=digialert_db;Username=postgres;Password=VotreMotDePasseDuFichierEnv"
```

---

## 🏗️ Architecture du Projet

### 1. Frontend (`/DigiAlert.Web`)
L'interface utilisateur est construite avec React et Vite.
* **Proxy et Kiosque :** Dans `vite.config.js`, l'option `host: true` est activée pour permettre l'accès depuis un réseau local (indispensable pour scanner le QR Code du Kiosque avec un smartphone). Le proxy redirige les requêtes `/api` vers le conteneur Backend.
* **Paramètres API :** La gestion des clés API (DigiSMS, Brevo) et du `Sender ID` se fait dans `src/pages/Parametres.jsx` (Architecture Multi-tenant).

### 2. Backend (`/DigiAlert.Api`)
* **Performances :** Utilisation d'`AsNoTracking()` pour la lecture, pagination SQL native, et `IHttpClientFactory` pour la gestion optimisée des appels HTTP externes.
* **Moteur d'envoi asynchrone (`CronEngineService.cs`) :** Un `BackgroundService` tourne en boucle toutes les 30 secondes pour scruter les événements `PENDING`. S'il est l'heure, il déclenche l'envoi de SMS/Email et met à jour le statut. Sécurisé par des transactions SQL pour éviter les envois en double.
* **Routage Intelligent :** Lors de l'annulation d'un événement (`POST /api/Events/{id}/cancel`), si des messages ont déjà été envoyés, le système force la création d'un nouveau message de type `CANCELLATION` pour prévenir les patients concernés.

---

## 🔌 Gestion des API (SMS & Email)

Le système est conçu pour être multitenant (SaaS) : chaque entreprise peut entrer ses propres clés d'API depuis l'interface web (onglet *Paramètres*).

### DigiSMS (SMS)
* L'intégration utilise l'API V1 de production (`POST https://apiservice.digi-sms.com/api/v1/public/sms/send`).
* **⚠️ Important concernant le Sender ID :** Les opérateurs locaux exigent que le `Sender ID` (ex: "CLINIQUE_X") soit autorisé (whitelisted) par le support de DigiSMS. Le code contient un fallback de sécurité ("DIGIALERT") si le client oublie de le renseigner ou s'il est refusé.

### Brevo (Emails)
* L'intégration utilise la clé API REST de Brevo (qui commence par `xkeysib-...` et non la clé SMTP `xsmtpsib-...`).
* Assurez-vous que l'adresse email d'expédition de l'entreprise a été préalablement validée sur le tableau de bord Brevo.

---

## 🔒 Sécurité & Bonnes Pratiques
* **Gestion des Secrets :** Un fichier `.gitignore` strict empêche les fichiers `.env` ou clés privées d'être poussés sur Git.
* **Chiffrement :** Les mots de passe des utilisateurs sont hachés avec `BCrypt` avant d'être sauvegardés en base de données.
* **Protection API :** Mise en place d'un `Rate Limiter` pour contrer les attaques par force brute ou le spam.

---

## 🚀 Prochaines Étapes (Mise en Production)
Pour le déploiement final sur un serveur cloud (VPS, AWS, Hostinger...) :
1. Créer un fichier `docker-compose.prod.yml`.
2. Créer un `Dockerfile` pour le frontend utilisant `Nginx` pour servir les fichiers statiques (après un `npm run build`).
3. Retirer les options `dotnet watch` du backend pour utiliser l'image en version `Release` (`dotnet publish`).
4. Utiliser des variables d'environnement serveur pour sécuriser la base de données de production.

---
*Projet initié et mené jusqu'à la V1 par Giovanni.* ✨