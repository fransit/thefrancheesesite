// Panel functionality
const Panel = {
  currentProductId: null,
  currentScript: '',
  products: [],
  
  init() {
    // Check authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    // Load user info
    this.loadUserInfo();

    // Setup event listeners
    this.setupEventListeners();

    // Handle URL-based navigation
    this.handleUrlNavigation();

    // Load initial data
    this.loadOverview();
    this.loadProducts();
  },
  
  loadUserInfo() {
    const user = Auth.getUser();
    if (user) {
      document.getElementById('userName').textContent = user.username;
      document.getElementById('userEmail').textContent = user.email;
      document.getElementById('userAvatar').textContent = user.username.charAt(0).toUpperCase();
    }
  },
  
  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        this.switchTab(tab);
        this.updateUrl(tab);
      });
    });
    
    // Subtab navigation
    document.querySelectorAll('.tab[data-subtab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchSubtab(tab.dataset.subtab);
      });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
    });
    
    // Add product button
    document.getElementById('addProductBtn').addEventListener('click', () => {
      this.openModal('addProductModal');
    });

    // DevLogs filters
    document.getElementById('productFilter').addEventListener('change', () => {
      this.filterDevLogs();
    });

    document.getElementById('sortOrder').addEventListener('change', () => {
      this.filterDevLogs();
    });
    
    // Enter key for product creation
    document.getElementById('productName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.createProduct();
      }
    });
  },
  
  switchTab(tab) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // Show selected tab
    document.getElementById(`${tab}Tab`).style.display = 'block';
    document.getElementById(`${tab}Tab`).classList.add('fade-in');

    // Load data for specific tabs
    if (tab === 'devlogs') {
      this.loadDevLogs();
    }
  },
  
  switchSubtab(subtab) {
    // Update tab buttons
    document.querySelectorAll('.tab[data-subtab]').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`.tab[data-subtab="${subtab}"]`).classList.add('active');
    
    // Hide all subtabs
    document.querySelectorAll('.subtab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // Show selected subtab
    document.getElementById(`${subtab}Subtab`).style.display = 'block';
    
    // Load data for subtab
    if (subtab === 'whitelist') {
      this.loadWhitelist();
    } else if (subtab === 'script') {
      this.loadScript();
    }
  },
  
  async loadOverview() {
    try {
      const response = await Auth.fetchWithAuth('/api/products');
      const data = await response.json();
      
      this.products = data.products || [];
      
      // Calculate stats
      let totalUsers = 0;
      let whitelisted = 0;
      let pending = 0;
      
      this.products.forEach(p => {
        totalUsers += p.user_count || 0;
      });
      
      // Get whitelist stats
      for (const product of this.products) {
        try {
          const wlResponse = await Auth.fetchWithAuth(`/api/whitelist/product/${product.id}`);
          const wlData = await wlResponse.json();
          
          (wlData.whitelist || []).forEach(w => {
            if (w.status === 'whitelisted') whitelisted++;
            else if (w.status === 'pending') pending++;
          });
        } catch (e) {}
      }
      
      document.getElementById('statProducts').textContent = this.products.length;
      document.getElementById('statUsers').textContent = totalUsers;
      document.getElementById('statWhitelisted').textContent = whitelisted;
      document.getElementById('statPending').textContent = pending;
      
      // Recent activity
      this.renderRecentActivity();
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  },
  
  renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          <h3>No products yet</h3>
          <p>Create your first product to start tracking usage</p>
          <button class="btn btn-primary" onclick="Panel.switchTab('products')">
            Go to Products
          </button>
        </div>
      `;
      return;
    }
    
    let html = '<div class="users-list">';
    this.products.slice(0, 5).forEach(product => {
      html += `
        <div class="user-item" style="grid-template-columns: 1fr 100px 120px;">
          <div class="game-info">
            <div class="game-name">${this.escapeHtml(product.name)}</div>
            <div class="place-id">Key: ${product.product_key.substring(0, 8)}...</div>
          </div>
          <span class="user-count">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${product.user_count || 0} users
          </span>
          <button class="btn btn-secondary btn-sm" onclick="Panel.viewProduct(${product.id})">
            View Details
          </button>
        </div>
      `;
    });
    html += '</div>';
    
    container.innerHTML = html;
  },
  
  async loadProducts() {
    try {
      const response = await Auth.fetchWithAuth('/api/products');
      const data = await response.json();
      
      this.products = data.products || [];
      this.renderProducts();
    } catch (error) {
      console.error('Error loading products:', error);
    }
  },
  
  renderProducts() {
    const container = document.getElementById('productsList');
    
    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          <h3>No products yet</h3>
          <p>Create your first product to start licensing</p>
        </div>
      `;
      return;
    }
    
    let html = `
      <table class="products-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Users</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    this.products.forEach(product => {
      html += `
        <tr>
          <td>
            <span class="product-name">${this.escapeHtml(product.name)}</span>
          </td>
          <td>
            <span class="user-count">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              ${product.user_count || 0}
            </span>
          </td>
          <td>
            <div class="actions">
              <button class="btn btn-secondary btn-sm" onclick="Panel.viewProduct(${product.id})">
                View Users
              </button>
              <button class="btn btn-info btn-sm" onclick="Panel.editProduct(${product.id})">
                Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="Panel.deleteProduct(${product.id})">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  async createProduct() {
    const name = document.getElementById('productName').value.trim();
    
    if (!name) {
      alert('Please enter a product name');
      return;
    }
    
    try {
      const response = await Auth.fetchWithAuth('/api/products', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Close add modal
        this.closeModal('addProductModal');
        document.getElementById('productName').value = '';
        
        // Show script modal
        document.getElementById('modalScriptContent').textContent = data.luaScript;
        this.currentScript = data.luaScript;
        this.openModal('scriptModal');
        
        // Reload products
        this.loadProducts();
        this.loadOverview();
      } else {
        alert(data.error || 'Failed to create product');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Error creating product');
    }
  },
  
  async deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await Auth.fetchWithAuth(`/api/products/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.loadProducts();
        this.loadOverview();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  },

  async editProduct(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    const newName = prompt('Enter new product name:', product.name);
    if (!newName || newName.trim() === '' || newName.trim() === product.name) {
      return;
    }

    try {
      const response = await Auth.fetchWithAuth(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName.trim() })
      });

      if (response.ok) {
        this.loadProducts();
        this.loadOverview();
        alert('Product name updated successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error updating product');
    }
  },
  
  async viewProduct(id) {
    this.currentProductId = id;
    
    const product = this.products.find(p => p.id === id);
    if (product) {
      document.getElementById('productDetailTitle').textContent = product.name;
    }
    
    // Show product detail tab
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    document.getElementById('productDetailTab').style.display = 'block';
    
    // Reset to users subtab
    this.switchSubtab('users');
    
    // Load users
    await this.loadProductUsers();
  },
  
  async loadProductUsers() {
    const container = document.getElementById('usersList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const response = await Auth.fetchWithAuth(`/api/products/${this.currentProductId}/users`);
      const data = await response.json();
      
      const users = data.users || [];
      
      if (users.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3>No users yet</h3>
            <p>Users will appear here when they use your script</p>
          </div>
        `;
        return;
      }
      
      let html = '<div class="users-list">';
      users.forEach(user => {
        const status = user.whitelist_status || 'pending';
        const statusClass = `status-${status}`;
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const isActive = user.is_active;
        
        html += `
          <div class="user-item">
            <div class="game-info">
              <div class="game-name">${this.escapeHtml(user.game_name || 'Unknown Game')}</div>
              <div class="place-id">Place ID: ${this.escapeHtml(user.place_id)}</div>
            </div>
            <span class="status-badge ${statusClass}">
              <span class="status-dot"></span>
              ${statusLabel}
            </span>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm ${status === 'whitelisted' ? 'btn-danger' : 'btn-secondary'}" 
                      onclick="Panel.toggleWhitelistStatus('${user.place_id}', '${status}')">
                ${status === 'whitelisted' ? 'Unwhitelist' : 'Whitelist'}
              </button>
            </div>
            <label class="toggle">
              <input type="checkbox" ${isActive ? 'checked' : ''} 
                     onchange="Panel.toggleActive('${user.place_id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        `;
      });
      html += '</div>';
      
      container.innerHTML = html;
    } catch (error) {
      console.error('Error loading users:', error);
      container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error loading users</p>';
    }
  },
  
  async loadWhitelist() {
    const container = document.getElementById('whitelistList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const response = await Auth.fetchWithAuth(`/api/whitelist/product/${this.currentProductId}`);
      const data = await response.json();
      
      const whitelist = data.whitelist || [];
      
      if (whitelist.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
            <h3>No whitelist entries</h3>
            <p>Add Place IDs to whitelist them</p>
          </div>
        `;
        return;
      }
      
      let html = '<div class="users-list">';
      whitelist.forEach(entry => {
        const status = entry.status || 'pending';
        const statusClass = `status-${status}`;
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const isActive = entry.is_active;
        
        html += `
          <div class="user-item">
            <div class="game-info">
              <div class="game-name">${this.escapeHtml(entry.game_name || 'Unknown Game')}</div>
              <div class="place-id">Place ID: ${this.escapeHtml(entry.place_id)}</div>
            </div>
            <span class="status-badge ${statusClass}">
              <span class="status-dot"></span>
              ${statusLabel}
            </span>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm ${status === 'whitelisted' ? 'btn-danger' : 'btn-secondary'}" 
                      onclick="Panel.toggleWhitelistStatus('${entry.place_id}', '${status}')">
                ${status === 'whitelisted' ? 'Unwhitelist' : 'Whitelist'}
              </button>
            </div>
            <label class="toggle">
              <input type="checkbox" ${isActive ? 'checked' : ''} 
                     onchange="Panel.toggleActive('${entry.place_id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        `;
      });
      html += '</div>';
      
      container.innerHTML = html;
    } catch (error) {
      console.error('Error loading whitelist:', error);
      container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error loading whitelist</p>';
    }
  },
  
  async addToWhitelist() {
    const placeId = document.getElementById('whitelistPlaceId').value.trim();
    const gameName = document.getElementById('whitelistGameName').value.trim();
    
    if (!placeId || !gameName) {
      alert('Please enter both Place ID and Game Name');
      return;
    }
    
    try {
      const response = await Auth.fetchWithAuth(`/api/whitelist/product/${this.currentProductId}`, {
        method: 'POST',
        body: JSON.stringify({ place_id: placeId, game_name: gameName })
      });
      
      if (response.ok) {
        document.getElementById('whitelistPlaceId').value = '';
        document.getElementById('whitelistGameName').value = '';
        this.loadWhitelist();
        this.loadProductUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add to whitelist');
      }
    } catch (error) {
      console.error('Error adding to whitelist:', error);
    }
  },
  
  async toggleWhitelistStatus(placeId, currentStatus) {
    const newStatus = currentStatus === 'whitelisted' ? 'unwhitelisted' : 'whitelisted';
    
    try {
      const response = await Auth.fetchWithAuth(`/api/whitelist/status/${this.currentProductId}/${placeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        this.loadWhitelist();
        this.loadProductUsers();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  },
  
  async toggleActive(placeId, isActive) {
    try {
      const response = await Auth.fetchWithAuth(`/api/whitelist/toggle/${this.currentProductId}/${placeId}`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        // Refresh both views
        this.loadWhitelist();
        this.loadProductUsers();
      }
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  },
  
  async loadScript() {
    const container = document.getElementById('scriptContent');
    container.textContent = 'Loading...';
    
    try {
      const response = await Auth.fetchWithAuth(`/api/products/${this.currentProductId}/script`);
      const data = await response.json();
      
      if (data.luaScript) {
        container.textContent = data.luaScript;
        this.currentScript = data.luaScript;
      }
    } catch (error) {
      console.error('Error loading script:', error);
      container.textContent = 'Error loading script';
    }
  },
  
  copyScript() {
    navigator.clipboard.writeText(this.currentScript).then(() => {
      alert('Script copied to clipboard!');
    });
  },
  
  copyModalScript() {
    navigator.clipboard.writeText(this.currentScript).then(() => {
      alert('Script copied to clipboard!');
    });
  },
  
  goBack() {
    this.switchTab('products');
  },
  
  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  },
  
  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  handleUrlNavigation() {
    const path = window.location.pathname;
    let tab = 'overview'; // default tab

    if (path === '/products') {
      tab = 'products';
    } else if (path === '/devlogs') {
      tab = 'devlogs';
    } else if (path === '/overview') {
      tab = 'overview';
    }

    this.switchTab(tab);
  },

  updateUrl(tab) {
    const path = tab === 'overview' ? '/overview' :
                 tab === 'products' ? '/products' :
                 tab === 'devlogs' ? '/devlogs' : '/overview';

    // Update URL without page reload
    window.history.pushState({}, '', path);
  },

  // DevLogs functionality
  devlogsData: [],
  filteredLogs: [],

  async loadDevLogs() {
    const container = document.getElementById('devlogsList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const response = await Auth.fetchWithAuth('/api/tracking/devlogs');
      const data = await response.json();

      this.devlogsData = data.logs || [];
      this.filteredLogs = [...this.devlogsData];

      // Populate product filter
      this.populateProductFilter(data.products || []);

      // Display logs
      this.displayDevLogs();
    } catch (error) {
      console.error('Error loading devlogs:', error);
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
          <h3>Failed to load logs</h3>
          <p>Please try again later</p>
        </div>
      `;
    }
  },

  populateProductFilter(products) {
    const filter = document.getElementById('productFilter');
    filter.innerHTML = '<option value="">All Products</option>';

    products.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = product.name;
      filter.appendChild(option);
    });
  },

  displayDevLogs() {
    const container = document.getElementById('devlogsList');

    if (this.filteredLogs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
          <h3>No activity logs yet</h3>
          <p>Activity logs will appear here when users use your scripts</p>
        </div>
      `;
      return;
    }

    let html = `
      <table class="devlogs-table">
        <thead>
          <tr>
            <th>Game Name</th>
            <th>Place ID</th>
            <th>Product Name</th>
            <th>User</th>
            <th>IP Address</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
    `;

    this.filteredLogs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const userInfo = log.roblox_username || 'Unknown';
      const ipHash = log.ip_address ? this.hashIP(log.ip_address) : 'Unknown';

      html += `
        <tr>
          <td class="game-name">${this.escapeHtml(log.game_name)}</td>
          <td class="place-id">${log.place_id}</td>
          <td class="product-name">${this.escapeHtml(log.product_name)}</td>
          <td class="user-info">${this.escapeHtml(userInfo)}</td>
          <td class="ip-address">${ipHash}</td>
          <td class="timestamp">${timestamp}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  hashIP(ip) {
    // Simple hash for privacy
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  },

  filterDevLogs() {
    const productFilter = document.getElementById('productFilter').value;
    const sortOrder = document.getElementById('sortOrder').value;

    // Filter by product
    if (productFilter) {
      this.filteredLogs = this.devlogsData.filter(log => log.product_id == productFilter);
    } else {
      this.filteredLogs = [...this.devlogsData];
    }

    // Sort
    this.filteredLogs.sort((a, b) => {
      let aVal, bVal;

      switch (sortOrder) {
        case 'timestamp DESC':
          return new Date(b.timestamp) - new Date(a.timestamp);
        case 'timestamp ASC':
          return new Date(a.timestamp) - new Date(b.timestamp);
        case 'game_name ASC':
          aVal = a.game_name.toLowerCase();
          bVal = b.game_name.toLowerCase();
          return aVal.localeCompare(bVal);
        case 'game_name DESC':
          aVal = a.game_name.toLowerCase();
          bVal = b.game_name.toLowerCase();
          return bVal.localeCompare(aVal);
        default:
          return new Date(b.timestamp) - new Date(a.timestamp);
      }
    });

    this.displayDevLogs();
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  Panel.init();
});
