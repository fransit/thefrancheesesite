// Auth helper functions

const Auth = {
  getToken() {
    return localStorage.getItem('token');
  },
  
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  isAuthenticated() {
    return !!this.getToken();
  },
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  },
  
  async fetchWithAuth(url, options = {}) {
    const token = this.getToken();
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    };
    
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };
    
    const response = await fetch(url, mergedOptions);
    
    if (response.status === 401) {
      this.logout();
      throw new Error('Session expired');
    }
    
    return response;
  }
};

// Export for use in other scripts
window.Auth = Auth;
