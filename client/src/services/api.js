/** Dev: `/api` is proxied by Vite (vite.config.js). Production: set VITE_API_URL on Render (e.g. https://your-api.onrender.com/api). */
const API_URL = import.meta.env.DEV
  ? '/api'
  : String(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[api] VITE_API_URL was not set at build time; API calls default to localhost and will fail on real phones. Set VITE_API_URL on your static host build.'
  );
}

// Auth API
export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }
    return response.json();
  },

  login: async (credentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    return response.json();
  },

  /**
   * Validates session with the API (works when Socket.io cannot reach the backend host).
   * Only `shouldInvalidate` true when we got a JSON auth error from our API — not a generic CDN/WAF 403 page.
   */
  sessionPing: async () => {
    const token = localStorage.getItem('token');
    if (!token) return { status: 204, message: '', shouldInvalidate: false };
    const response = await fetch(`${API_URL}/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { status: response.status, message: '', shouldInvalidate: false };
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return { status: response.status, message: '', shouldInvalidate: false };
    }
    const msg = typeof data.message === 'string' ? data.message : '';
    const shouldInvalidate =
      (response.status === 401 || response.status === 403) &&
      data.success === false &&
      msg.trim().length > 0;
    return { status: response.status, message: msg, shouldInvalidate };
  },
};

// Workouts API
export const workoutsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/workouts`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch workouts');
    return response.json();
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/workouts/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch workout');
    return response.json();
  },

  create: async (workoutData) => {
    const response = await fetch(`${API_URL}/workouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(workoutData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to create workout');
    return data;
  },

  update: async (id, workoutData) => {
    const response = await fetch(`${API_URL}/workouts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(workoutData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to update workout');
    return data;
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/workouts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to delete workout');
    return response.json();
  },

  getCommunity: async () => {
    const response = await fetch(`${API_URL}/workouts/community/all`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch community workouts');
    return response.json();
  },

  getCommunityByUser: async (userId) => {
    const response = await fetch(`${API_URL}/workouts/community/by-user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch user workouts');
    return response.json();
  },
};

// Admin API (requires role=admin on server)
export const adminAPI = {
  getStats: async () => {
    const response = await fetch(`${API_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to load stats');
    return data;
  },
  getUsers: async () => {
    const response = await fetch(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to load users');
    return data;
  },
  setUserRole: async (userId, role) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ role }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to update role');
    return data;
  },
  deleteUser: async (userId) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to delete user');
    return data;
  },
  setUserPoints: async (userId, points) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/points`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ points }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to update points');
    return data;
  },
  getUser: async (userId) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to load user');
    return data;
  },
  getUserSummary: async (userId) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to load summary');
    return data;
  },
  updateUserProfile: async (userId, payload) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to update profile');
    return data;
  },
  setUserPassword: async (userId, newPassword) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to set password');
    return data;
  },
  getActivity: async () => {
    const response = await fetch(`${API_URL}/admin/activity`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to load activity');
    return data;
  },
  setUserSuspended: async (userId, suspended) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ suspended }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to update suspension');
    return data;
  },
  clearAllChat: async () => {
    const response = await fetch(`${API_URL}/admin/chat/clear-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ confirm: 'DELETE_ALL_CHAT' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Failed to clear chat');
    return data;
  },
};

// Profile API
export const profileAPI = {
  getProfile: async () => {
    const response = await fetch(`${API_URL}/profile`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || 'Failed to fetch profile');
      err.status = response.status;
      throw err;
    }
    return data;
  },

  getPublicProfile: async (userId) => {
    const response = await fetch(`${API_URL}/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch user profile');
    const data = await response.json();
    return data;
  },

  updateProfile: async (profileData) => {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(profileData)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update profile');
    }
    return data;
  },
};

// Tracking API (body weight, water, PR)
export const trackingAPI = {
  getBodyWeight: async () => {
    const res = await fetch(`${API_URL}/tracking/body-weight`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch body weight');
    return res.json();
  },
  addBodyWeight: async (data) => {
    const res = await fetch(`${API_URL}/tracking/body-weight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add body weight');
    return res.json();
  },
  deleteBodyWeight: async (id) => {
    const res = await fetch(`${API_URL}/tracking/body-weight/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete');
    return res.json();
  },
  getWaterToday: async () => {
    const res = await fetch(`${API_URL}/tracking/water/today`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch water');
    return res.json();
  },
  addWater: async (data) => {
    const res = await fetch(`${API_URL}/tracking/water`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add water');
    return res.json();
  },
  deleteWater: async (id) => {
    const res = await fetch(`${API_URL}/tracking/water/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete water entry');
    return res.json();
  },
  getPR: async () => {
    const res = await fetch(`${API_URL}/tracking/pr`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch PRs');
    return res.json();
  },

  getPRByUser: async (userId) => {
    const res = await fetch(`${API_URL}/tracking/pr/user/${userId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user PRs');
    return res.json();
  },
  addPR: async (data) => {
    const res = await fetch(`${API_URL}/tracking/pr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add PR');
    return res.json();
  },
  deletePR: async (id) => {
    const res = await fetch(`${API_URL}/tracking/pr/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete');
    return res.json();
  },
};

// Progress Photos API
export const progressPhotosAPI = {
  getAll: async () => {
    const res = await fetch(`${API_URL}/progress-photos`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch progress photos');
    return res.json();
  },
  add: async (data) => {
    const res = await fetch(`${API_URL}/progress-photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add photo');
    return res.json();
  },
  delete: async (id) => {
    const res = await fetch(`${API_URL}/progress-photos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete photo');
    return res.json();
  },
  getCommunity: async ({ limit = 18, skip = 0 } = {}) => {
    const q = new URLSearchParams({
      limit: String(limit),
      skip: String(skip),
    });
    const res = await fetch(`${API_URL}/community-photos?${q.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error("Failed to fetch Bruski's photos");
    return res.json();
  },
  createCommunityPost: async (data) => {
    const res = await fetch(`${API_URL}/community-photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    const raw = await res.text();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
    if (!res.ok) {
      if (res.status === 413) {
        throw new Error('Photo is too large. Try another image or one taken at lower resolution.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(body.message || 'Session expired. Log in again and try posting.');
      }
      const hint =
        body.message ||
        body.error ||
        (raw && raw.length < 200 ? raw.trim() : '') ||
        `Could not reach server (${res.status}). Is the API running?`;
      throw new Error(hint);
    }
    return body;
  },
  toggleCommunityLike: async (postId) => {
    const res = await fetch(`${API_URL}/community-photos/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Failed to like post');
    return body;
  },
  addCommunityComment: async (postId, text) => {
    const res = await fetch(`${API_URL}/community-photos/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Failed to comment');
    return body;
  },
  deleteCommunityPost: async (postId) => {
    const res = await fetch(`${API_URL}/community-photos/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Failed to delete post');
    return body;
  },
};

// Challenges API
export const challengesAPI = {
  getList: async () => {
    const res = await fetch(`${API_URL}/challenges`);
    if (!res.ok) throw new Error('Failed to fetch challenges');
    return res.json();
  },
  getLeaderboard: async () => {
    const res = await fetch(`${API_URL}/challenges/leaderboard`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    return res.json();
  },
  award: async (action) => {
    const res = await fetch(`${API_URL}/challenges/award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error('Failed to award points');
    return res.json();
  },
};

// Workout Sessions API (completed workout history)
export const workoutSessionsAPI = {
  getStats: async () => {
    const res = await fetch(`${API_URL}/workout-sessions/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) {
      const err = new Error('Failed to fetch workout stats');
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
  getAll: async () => {
    const res = await fetch(`${API_URL}/workout-sessions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) {
      const err = new Error('Failed to fetch workout history');
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
  create: async (data) => {
    const res = await fetch(`${API_URL}/workout-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save workout');
    return res.json();
  },
  delete: async (id) => {
    const res = await fetch(`${API_URL}/workout-sessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete workout');
    return res.json();
  },
  deleteAll: async () => {
    const res = await fetch(`${API_URL}/workout-sessions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete history');
    return res.json();
  },
};

// Chat API
export const chatAPI = {
  getPublicMessages: async () => {
    const res = await fetch(`${API_URL}/chat/public/messages`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  },
  sendPublicMessage: async (content, replyTo) => {
    const res = await fetch(`${API_URL}/chat/public/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ content, ...(replyTo && { replyTo }) }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },
  getConversations: async () => {
    const res = await fetch(`${API_URL}/chat/conversations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },
  createConversation: async (otherUserId) => {
    const res = await fetch(`${API_URL}/chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ otherUserId }),
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    return res.json();
  },
  createGroupChat: async (name, participantIds) => {
    const res = await fetch(`${API_URL}/chat/conversations/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name, participantIds }),
    });
    if (!res.ok) throw new Error('Failed to create group');
    return res.json();
  },
  getConversationMessages: async (conversationId) => {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  },
  sendPrivateMessage: async (conversationId, content, replyTo) => {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ content, ...(replyTo && { replyTo }) }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },
  getUsers: async () => {
    const res = await fetch(`${API_URL}/chat/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },
  deleteConversation: async (conversationId) => {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete conversation');
    return res.json();
  },
  addToGroup: async (conversationId, userId) => {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to add member');
    }
    return res.json();
  },
  kickFromGroup: async (conversationId, userId) => {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/kick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to kick member');
    }
    return res.json();
  },
  updatePublicMessage: async (messageId, content) => {
    const id = typeof messageId === 'string' ? messageId : messageId?.toString?.() || messageId;
    const res = await fetch(`${API_URL}/chat/public/messages/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Failed to update message');
    return res.json();
  },
  updatePrivateMessage: async (conversationId, messageId, content) => {
    const cId = typeof conversationId === 'string' ? conversationId : conversationId?.toString?.() || conversationId;
    const mId = typeof messageId === 'string' ? messageId : messageId?.toString?.() || messageId;
    const res = await fetch(`${API_URL}/chat/conversations/${cId}/messages/${mId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Failed to update message');
    return res.json();
  },
  deletePublicMessage: async (messageId) => {
    const res = await fetch(`${API_URL}/chat/public/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete message');
    return res.json();
  },
  deletePrivateMessage: async (conversationId, messageId) => {
    const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to delete message');
    return res.json();
  },
};

// Alias for backward compatibility
export const workoutAPI = workoutsAPI;
