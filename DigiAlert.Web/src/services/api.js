// Service centralisé pour les appels à l'API.

// L'URL de base peut être remplacée par la variable d'environnement prévue pour la production.
export const BASE_URL = import.meta.env.VITE_API_URL || '';

export const fetchWithAuth = async (endpoint, options = {}) => {
    // 1. Récupère le token enregistré dans le navigateur.
    const token = localStorage.getItem('jwtToken');
    
    // 2. Prépare les en-têtes de la requête.
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // 3. Ajoute le token au format Bearer lorsqu'il est disponible.
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 4. Envoie la requête vers l'API.
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // 5. En cas de réponse 401, supprime la session et redirige vers la connexion.
    if (response.status === 401) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        window.location.href = '/login'; // On force le retour à la page de connexion
    }

    return response;
};

const api = {
    get: (endpoint) => fetchWithAuth(endpoint, { method: 'GET' }),
    post: (endpoint, data) => fetchWithAuth(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data) => fetchWithAuth(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};
export default api;
