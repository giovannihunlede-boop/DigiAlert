// src/services/api.js

// L'adresse de base de ton API (tu pourras la changer via un fichier .env plus tard pour la prod)
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5294';

export const fetchWithAuth = async (endpoint, options = {}) => {
    // 1. On récupère le badge (Token) s'il existe dans le stockage du navigateur
    const token = localStorage.getItem('jwtToken');
    
    // 2. On prépare les en-têtes (Headers)
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // 3. Si on a un Token, on l'attache au format officiel : "Bearer <token>"
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 4. On lance la requête
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // 5. Sécurité : Si l'API nous jette (Code 401 Unauthorized), c'est que le token est mort
    if (response.status === 401) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        window.location.href = '/login'; // On force le retour à la page de connexion
    }

    return response;
};