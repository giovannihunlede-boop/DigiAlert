export const BASE_URL = import.meta.env.VITE_API_URL || '';

export const fetchWithAuth = async (endpoint, options = {}) => {
    const token = localStorage.getItem('jwtToken');
    // en-têtes de la requête.
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        window.location.href = '/login'; 
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
