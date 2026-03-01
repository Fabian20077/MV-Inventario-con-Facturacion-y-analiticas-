/**
 * Unified Navbar Component - MV Inventario Pro
 * Inject into any page with: <div id="unified-navbar"></div>
 * Then load: <script src="../scripts/navbar.js"></script>
 */
(function () {
    const NAV_LINKS = [
        { href: 'dashboard.html', icon: 'bi-speedometer2', label: 'Dashboard' },
        { href: 'productos.html', icon: 'bi-box-seam', label: 'Productos' },
        { href: 'movimientos.html', icon: 'bi-arrow-left-right', label: 'Movimientos' },
        { href: 'analytics.html', icon: 'bi-graph-up', label: 'Análisis' },
        { href: 'historial-precios.html', icon: 'bi-clock-history', label: 'Histórico' },
        { href: 'facturacion.html', icon: 'bi-receipt', label: 'Facturación' },
    ];

    function getCurrentPage() {
        const path = window.location.pathname;
        const file = path.split('/').pop() || 'dashboard.html';
        return file;
    }

    function isDarkMode() {
        return localStorage.getItem('darkMode') === 'true' || localStorage.getItem('theme-preference') === 'dark';
    }

    function renderNavbar() {
        const container = document.getElementById('unified-navbar');
        if (!container) return;

        const currentPage = getCurrentPage();
        const dark = isDarkMode();

        // Apply dark mode on load
        if (dark) document.body.classList.add('dark-mode');

        const linksHTML = NAV_LINKS.map(link => {
            const isActive = currentPage === link.href ||
                (currentPage === '' && link.href === 'dashboard.html');
            return `<a href="${link.href}" class="mv-nav-link ${isActive ? 'mv-nav-active' : ''}" title="${link.label}">
                <i class="bi ${link.icon}"></i>
                <span class="mv-nav-label">${link.label}</span>
            </a>`;
        }).join('');

        container.innerHTML = `
        <nav class="mv-navbar" id="mvNavbar">
            <div class="mv-nav-container">
                <div class="mv-nav-brand">
                    <a href="dashboard.html" class="mv-brand-link">
                        <img id="mvNavLogo" src="" alt="" class="mv-brand-logo" style="display:none;">
                        <i class="bi bi-box-fill" id="mvBrandIcon"></i>
                        <span>MV Inventario</span>
                    </a>
                    <button class="mv-hamburger" id="mvHamburger" aria-label="Menú">
                        <i class="bi bi-list"></i>
                    </button>
                </div>
                <div class="mv-nav-links" id="mvNavLinks">
                    ${linksHTML}
                </div>
                <div class="mv-nav-actions">
                    <button class="mv-notifications-btn" id="mvNotificationsBtn" title="Notificaciones" onclick="toggleAlertas()">
                        <i class="bi bi-bell"></i>
                        <span id="alertasBadge" class="mv-notification-badge" style="display: none;">0</span>
                    </button>
                    <div class="mv-user-dropdown" style="position: relative;">
                        <button class="mv-user-btn" id="mvUserBtn">
                            <span class="mv-user-initial">A</span>
                            <span class="mv-user-name">Admin</span>
                            <i class="bi bi-chevron-down" style="font-size: 10px;"></i>
                        </button>
                        <div class="mv-user-dropdown-menu" id="mvUserDropdown">
                            <a href="settings.html" id="adminSettingsLink" class="dropdown-item" style="display: none;">
                                <i class="bi bi-gear"></i>
                                <span>Configuración</span>
                            </a>
                            <div class="dropdown-item" onclick="logout()">
                                <i class="bi bi-box-arrow-right"></i>
                                <span>Cerrar Sesión</span>
                            </div>
                        </div>
                    </div>
                    <button class="mv-dark-toggle" id="mvDarkToggle" title="Modo oscuro">
                        <i class="bi ${dark ? 'bi-sun-fill' : 'bi-moon-fill'}"></i>
                    </button>
                </div>
            </div>
        </nav>`;

        // Load company logo
        loadNavbarLogo();

        // Hamburger toggle
        const hamburger = document.getElementById('mvHamburger');
        const navLinks = document.getElementById('mvNavLinks');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', () => {
                navLinks.classList.toggle('mv-nav-open');
                hamburger.querySelector('i').className =
                    navLinks.classList.contains('mv-nav-open') ? 'bi bi-x-lg' : 'bi bi-list';
            });
        }

        // Dark mode toggle
        const darkBtn = document.getElementById('mvDarkToggle');
        if (darkBtn) {
            darkBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const nowDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('darkMode', nowDark);
                localStorage.setItem('theme-preference', nowDark ? 'dark' : 'light');
                darkBtn.querySelector('i').className = nowDark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
            });
        }

        // User dropdown toggle
        const userBtn = document.getElementById('mvUserBtn');
        const userDropdown = document.getElementById('mvUserDropdown');
        if (userBtn && userDropdown) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
            document.addEventListener('click', () => {
                userDropdown.classList.remove('active');
            });
            userDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Load user initial and name
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                const initialEl = document.querySelector('.mv-user-initial');
                const nameEl = document.querySelector('.mv-user-name');
                if (user.nombre) {
                    if (initialEl) initialEl.textContent = user.nombre.charAt(0).toUpperCase();
                    if (nameEl) nameEl.textContent = user.nombre;
                }
            }
        } catch (e) { }
    }

    // Load company logo into navbar brand
    function loadNavbarLogo() {
        const apiBase = window.location.origin;

        fetch(apiBase + '/api/configuracion')
            .then(r => r.json())
            .then(result => {
                console.log('Logo config response:', result);
                if (result.success && result.data) {
                    const applyUi = result.data['empresa.logo.apply_ui'];
                    const logoPath = result.data['empresa.logo_path'];
                    console.log('applyUi:', applyUi, 'logoPath:', logoPath);
                    
                    if ((applyUi === true || applyUi === 'true' || applyUi === 1 || applyUi === '1') && logoPath) {
                        const fullPath = logoPath.startsWith('http') ? logoPath : `${apiBase}${logoPath.startsWith('/') ? '' : '/'}${logoPath}`;
                        const logoImg = document.getElementById('mvNavLogo');
                        const brandIcon = document.getElementById('mvBrandIcon');
                        if (logoImg) {
                            logoImg.src = `${fullPath}?t=${Date.now()}`;
                            logoImg.style.display = 'block';
                            if (brandIcon) brandIcon.style.display = 'none';
                        }
                    }
                }
            })
            .catch((err) => { console.error('Error loading logo:', err); });
    }

    // Inject styles
    function injectStyles() {
        if (document.getElementById('mv-navbar-styles')) return;
        const style = document.createElement('style');
        style.id = 'mv-navbar-styles';
        style.textContent = `
        .mv-navbar {
            background: linear-gradient(135deg, #0f2b46 0%, #163d64 50%, #0f2b46 100%);
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
            position: sticky;
            top: 0;
            z-index: 1000;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        body.dark-mode .mv-navbar {
            background: linear-gradient(135deg, #0a0f1a 0%, #141e30 50%, #0a0f1a 100%);
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
            border-bottom-color: rgba(255, 255, 255, 0.05);
        }
        .mv-nav-container {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            height: 56px;
            gap: 16px;
        }
        .mv-nav-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .mv-brand-link {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #ffffff;
            text-decoration: none;
            font-weight: 700;
            font-size: 1.1rem;
            letter-spacing: -0.3px;
            white-space: nowrap;
        }
        .mv-brand-link i {
            font-size: 1.3rem;
            color: #60a5fa;
        }
        .mv-brand-link:hover {
            color: #93c5fd;
        }
        .mv-hamburger {
            display: none;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #ffffff;
            font-size: 1.3rem;
            padding: 6px 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .mv-hamburger:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .mv-nav-links {
            display: flex;
            align-items: center;
            gap: 2px;
            flex: 1;
            justify-content: center;
        }
        .mv-nav-link {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            color: rgba(255, 255, 255, 0.7);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 500;
            border-radius: 8px;
            transition: all 0.2s ease;
            white-space: nowrap;
        }
        .mv-nav-link i {
            font-size: 1rem;
        }
        .mv-nav-link:hover {
            color: #ffffff;
            background: rgba(255, 255, 255, 0.1);
        }
        .mv-nav-link.mv-nav-active {
            color: #ffffff;
            background: rgba(59, 130, 246, 0.3);
            font-weight: 600;
        }
        body.dark-mode .mv-nav-link.mv-nav-active {
            background: rgba(99, 102, 241, 0.35);
        }
        .mv-nav-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .mv-dark-toggle {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #fbbf24;
            font-size: 1rem;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .mv-dark-toggle:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.1);
        }
        body.dark-mode .mv-dark-toggle {
            color: #fbbf24;
            background: rgba(251, 191, 36, 0.15);
            border-color: rgba(251, 191, 36, 0.3);
        }
        .mv-nav-user {
            display: flex;
            align-items: center;
            gap: 6px;
            color: rgba(255, 255, 255, 0.85);
            font-size: 0.85rem;
            font-weight: 500;
        }
        .mv-nav-user i {
            font-size: 1.2rem;
            color: #60a5fa;
        }

        /* Responsive */
        @media (max-width: 900px) {
            .mv-nav-label { display: none; }
            .mv-nav-link { padding: 8px 10px; }
        }
        @media (max-width: 700px) {
            .mv-hamburger { display: flex; }
            .mv-nav-links {
                display: none;
                position: absolute;
                top: 56px;
                left: 0;
                right: 0;
                flex-direction: column;
                background: inherit;
                padding: 8px 16px 16px;
                gap: 4px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            .mv-nav-links.mv-nav-open {
                display: flex;
            }
            .mv-nav-link {
                width: 100%;
                padding: 10px 16px;
            }
            .mv-nav-label { display: inline; }
            .mv-nav-container { flex-wrap: wrap; }
        }
        .mv-brand-logo {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            object-fit: cover;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .mv-notifications-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.85);
            font-size: 1rem;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            position: relative;
        }
        .mv-notifications-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }
        .mv-notification-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 10px;
            min-width: 16px;
            text-align: center;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.5);
        }
        .mv-user-dropdown {
            position: relative;
        }
        .mv-user-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.85);
            padding: 6px 12px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
            font-weight: 500;
        }
        .mv-user-btn:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .mv-user-initial {
            width: 22px;
            height: 22px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.75rem;
            font-weight: 700;
        }
        .mv-user-name {
            font-weight: 500;
        }
        .mv-user-dropdown-menu {
            display: none;
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            min-width: 180px;
            z-index: 1000;
            border: 1px solid rgba(226, 232, 240, 0.6);
            overflow: hidden;
        }
        body.dark-mode .mv-user-dropdown-menu {
            background: rgba(42, 42, 71, 0.98);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }
        .mv-user-dropdown-menu.active {
            display: block;
            animation: slideDown 0.2s ease;
        }
        .mv-user-dropdown-menu .dropdown-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            color: #1e293b;
            cursor: pointer;
            transition: all 0.15s;
            font-size: 0.85rem;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        body.dark-mode .mv-user-dropdown-menu .dropdown-item {
            color: #f1f5f9;
            border-bottom-color: rgba(255, 255, 255, 0.05);
        }
        .mv-user-dropdown-menu .dropdown-item:last-child {
            border-bottom: none;
        }
        .mv-user-dropdown-menu .dropdown-item:hover {
            background: rgba(59, 130, 246, 0.1);
            padding-left: 18px;
        }
        body.dark-mode .mv-user-dropdown-menu .dropdown-item:hover {
            background: rgba(99, 102, 241, 0.2);
        }
        .mv-user-dropdown-menu .dropdown-item i {
            font-size: 1rem;
            color: #3b82f6;
        }
        body.dark-mode .mv-user-dropdown-menu .dropdown-item i {
            color: #a855f7;
        }
        @media (max-width: 700px) {
            .mv-user-name { display: none; }
        }
        `;
        document.head.appendChild(style);
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { injectStyles(); renderNavbar(); });
    } else {
        injectStyles();
        renderNavbar();
    }

    // Expose toggleDarkMode globally for pages that call it
    window.toggleDarkMode = function () {
        const btn = document.getElementById('mvDarkToggle');
        if (btn) btn.click();
    };
})();
