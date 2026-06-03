const API_URL = 'http://localhost:5000/api';

export const loginUser = async (email, name) => {
    console.log("kkkkk")
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
    });
    return response.json();
};

export const addItemManual = async (userId, itemName) => {
    const response = await fetch(`${API_URL}/list/add-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, item_name: itemName }),
    });
    return response.json();
};

/** Upload image/PDF — extracts products and adds to list only (no route). */
export const uploadFileToList = async (userId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', String(userId));

    const response = await fetch(`${API_URL}/upload-and-calculate`, {
        method: 'POST',
        body: formData,
    });
    const data = await response.json();
    if (!response.ok && !data.code) {
        return { success: false, error: data.error || `Request failed (${response.status})` };
    }
    return data;
};

export const calculatePath = async (userId) => {
    console.log("calculatePath",calculatePath);
    const response = await fetch(`${API_URL}/calculate-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    return response.json();
};
export const addVoiceItemsAI = async (userId, transcript) => {
    const response = await fetch(`${API_URL}/list/add-voice-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, transcript }),
    });
    return response.json();
};