/**
 * Unified Navbar Component - MV Inventario Pro
 * Inject into any page with: <div id="unified-navbar"></div>
 * Then load: <script src="../scripts/notification-manager.js"></script>
 *           <script src="../scripts/navbar.js"></script>
 */
(function () {
    const NAV_LINKS = [
        { href: 'dashboard.html', icon: 'bi-speedometer2', label: 'Dashboard' },
        { href: 'productos.html', icon: 'bi-box-seam', label: 'Productos' },
        { href: 'movimientos.html', icon: 'bi-arrow-left-right', label: 'Movimientos' },
        { href: 'analytics.html', icon: 'bi-graph-up', label: 'Análisis' },
        { href: 'historial-precios.html', icon: 'bi-clock-history', label: 'Precios' },
        { href: 'facturacion.html', icon: 'bi-receipt', label: 'Facturación' },
    ];

    function getCurrentPage() {
        const path = window.location.pathname;
        const file = path.split('/').pop() || 'dashboard.html';
        return file;
    }

    function renderNavbar() {
        const container = document.getElementById('unified-navbar');
        if (!container) return;

        const currentPage = getCurrentPage();

        // Aplicar modo oscuro permanente
        document.body.classList.add('dark-mode');

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
                    <div class="mv-notifications-wrapper" style="position:relative;">
                        <button class="mv-notifications-btn" id="mvNotificationsBtn" title="Notificaciones" onclick="toggleAlertas()">
                            <i class="bi bi-bell"></i>
                            <span id="alertasBadge" class="mv-notification-badge" style="display: none;">0</span>
                        </button>
                        <div class="mv-notifications-dropdown" id="mvNotificationsDropdown">
                            <div class="mv-notif-header">
                                <span><i class="bi bi-bell me-1"></i> Notificaciones</span>
                            </div>
                            <div class="mv-notif-body" id="mvNotifBody">
                                <div class="mv-notif-empty">Cargando...</div>
                            </div>
                        </div>
                    </div>
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

        // Load user initial, name and admin visibility
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
                // Mostrar enlace de configuración solo para administradores (rol_id === 1)
                if (user.rol_id === 1) {
                    const settingsLink = document.getElementById('adminSettingsLink');
                    if (settingsLink) {
                        settingsLink.style.display = 'flex';
                    }
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

    // Fallback global helpers (para que el navbar funcione en todas las páginas)
    if (typeof window.logout !== 'function') {
        window.logout = function () {
            try {
                localStorage.removeItem('user');
                localStorage.removeItem('authToken');
            } catch (e) { }
            // Redirigir siempre al login principal
            window.location.href = 'login.html';
        };
    }

    if (typeof window.toggleAlertas !== 'function') {
        window.toggleAlertas = function () {
            // Primero intentar el dropdown del dashboard si existe
            const dashDropdown = document.getElementById('alertasDropdown');
            if (dashDropdown) {
                const isHidden = dashDropdown.style.display === '' || dashDropdown.style.display === 'none';
                dashDropdown.style.display = isHidden ? 'block' : 'none';
                if (isHidden && typeof window.loadAlertas === 'function') {
                    window.loadAlertas();
                }
                return;
            }

            // Usar el dropdown inline del navbar
            const dropdown = document.getElementById('mvNotificationsDropdown');
            if (!dropdown) return;

            const isActive = dropdown.classList.contains('active');
            dropdown.classList.toggle('active');

            if (!isActive) {
                // Cargar notificaciones al abrir
                _loadNavbarNotifications();
            }
        };
    }

    // Cerrar dropdown de notificaciones al hacer clic fuera
    document.addEventListener('click', function (e) {
        const dropdown = document.getElementById('mvNotificationsDropdown');
        const btn = document.getElementById('mvNotificationsBtn');
        if (dropdown && dropdown.classList.contains('active')) {
            if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const dropdown = document.getElementById('mvNotificationsDropdown');
            if (dropdown) dropdown.classList.remove('active');
        }
    });

    // Cargar notificaciones desde la API
    function _loadNavbarNotifications() {
        const body = document.getElementById('mvNotifBody');
        if (!body) return;

        // Usar notificationManager si está disponible
        if (typeof window.notificationManager !== 'undefined') {
            window.updateNotificationUI(window.notificationManager.getAll());
        } else {
            body.innerHTML = '<div class="mv-notif-empty"><div class="mv-notif-spinner"></div></div>';
        }
    }

    // Función global para actualizar UI de notificaciones
    window.updateNotificationUI = function(notifications) {
        const body = document.getElementById('mvNotifBody');
        if (!body) return;

        const badge = document.getElementById('alertasBadge');

        if (!Array.isArray(notifications) || notifications.length === 0) {
            body.innerHTML = '<div class="mv-notif-empty"><i class="bi bi-check-circle" style="font-size:1.5rem;color:#10b981;"></i><p>Sin notificaciones nuevas</p></div>';
            if (badge) badge.style.display = 'none';
            return;
        }

        if (badge) {
            badge.textContent = notifications.length;
            badge.style.display = 'flex';
        }

        body.innerHTML = notifications.slice(0, 10).map((notif, idx) => {
            return `<div class="mv-notif-item" id="notif-${notif.id}">
                <div class="mv-notif-icon"><i class="bi bi-exclamation-triangle"></i></div>
                <div class="mv-notif-content">
                    <div class="mv-notif-title">${notif.title}</div>
                    <div class="mv-notif-desc">Stock: <strong>${notif.quantity}</strong> / Mín: ${notif.minimum}</div>
                </div>
                <button class="mv-notif-close" onclick="cerrarNotificacionGlobal('${notif.id}')" title="Cerrar"><i class="bi bi-x"></i></button>
            </div>`;
        }).join('') + (notifications.length > 10 ? '<div class="mv-notif-more">+' + (notifications.length - 10) + ' más...</div>' : '');
    };

    // Función global para cerrar notificaciones
    window.cerrarNotificacionGlobal = function(notificationId) {
        if (typeof window.notificationManager !== 'undefined') {
            window.notificationManager.removeNotification(notificationId);
            // Disparar actualización inmediata
            const body = document.getElementById('mvNotifBody');
            if (body) {
                const element = document.getElementById('notif-' + notificationId);
                if (element) {
                    element.style.animation = 'fadeOut 0.3s ease forwards';
                    setTimeout(() => {
                        element.remove();
                        // Si no hay más notificaciones, actualizar UI
                        if (!body.querySelector('.mv-notif-item')) {
                            body.innerHTML = '<div class="mv-notif-empty"><i class="bi bi-check-circle" style="font-size:1.5rem;color:#10b981;"></i><p>Sin notificaciones nuevas</p></div>';
                            const badge = document.getElementById('alertasBadge');
                            if (badge) badge.style.display = 'none';
                        }
                    }, 300);
                }
            }
        }
    };

    // Cargar badge al iniciar desde notification manager
    function _initNotificationBadge() {
        // Esperar a que notificationManager esté cargado
        if (typeof window.notificationManager !== 'undefined') {
            const notifications = window.notificationManager.getAll();
            const badge = document.getElementById('alertasBadge');
            if (badge && notifications.length > 0) {
                badge.textContent = notifications.length;
                badge.style.display = 'flex';
            }
        } else {
            // Si notificationManager no está listo, reintentar
            setTimeout(_initNotificationBadge, 500);
        }
    }
    // Auto-load badge count after a short delay
    setTimeout(_initNotificationBadge, 1500);

    // Escuchar cambios en notificaciones desde otras pestañas
    window.addEventListener('notificationsUpdated', (e) => {
        if (e.detail && e.detail.notifications) {
            window.updateNotificationUI(e.detail.notifications);
            const badge = document.getElementById('alertasBadge');
            if (badge) {
                if (e.detail.notifications.length > 0) {
                    badge.textContent = e.detail.notifications.length;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    });

    // Inject styles
    function injectStyles() {
        if (document.getElementById('mv-navbar-styles')) return;
        const style = document.createElement('style');
        style.id = 'mv-navbar-styles';
        style.textContent = `
        .mv-navbar {
            background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #0d0d0d 100%);
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
            position: sticky;
            top: 0;
            z-index: 1000;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        body.dark-mode .mv-navbar {
            background: linear-gradient(135deg, #050505 0%, #141414 50%, #050505 100%);
            box-shadow: 0 2px 16px rgba(0, 0, 0, 0.9);
            border-bottom-color: rgba(255, 255, 255, 0.04);
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

        /* Notification Dropdown */
        .mv-notifications-wrapper { position: relative; }
        .mv-notifications-dropdown {
            display: none;
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            width: 320px;
            max-height: 400px;
            background: rgba(255,255,255,0.98);
            backdrop-filter: blur(12px);
            border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.25);
            border: 1px solid rgba(226,232,240,0.6);
            z-index: 1100;
            overflow: hidden;
            animation: mvNotifSlide 0.2s ease;
        }
        body.dark-mode .mv-notifications-dropdown {
            background: rgba(30,30,55,0.98);
            border-color: rgba(255,255,255,0.1);
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
        }
        .mv-notifications-dropdown.active { display: block; }
        @keyframes mvNotifSlide {
            from { opacity:0; transform:translateY(-8px); }
            to { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity:1; transform:translateX(0); }
            to { opacity:0; transform:translateX(20px); }
        }
        .mv-notif-header {
            padding: 12px 16px;
            font-weight: 600;
            font-size: 0.9rem;
            color: #1e293b;
            border-bottom: 1px solid rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        body.dark-mode .mv-notif-header {
            color: #f1f5f9;
            border-bottom-color: rgba(255,255,255,0.08);
        }
        .mv-notif-body {
            max-height: 340px;
            overflow-y: auto;
        }
        .mv-notif-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 16px;
            border-bottom: 1px solid rgba(0,0,0,0.04);
            transition: background 0.15s;
            cursor: default;
            position: relative;
        }
        body.dark-mode .mv-notif-item {
            border-bottom-color: rgba(255,255,255,0.04);
        }
        .mv-notif-item:hover { background: rgba(59,130,246,0.06); }
        body.dark-mode .mv-notif-item:hover { background: rgba(99,102,241,0.15); }
        .mv-notif-close {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 24px;
            height: 24px;
            padding: 0;
            border: none;
            background: rgba(255,255,255,0.8);
            color: #64748b;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.85rem;
            transition: all 0.15s;
            opacity: 0;
        }
        .mv-notif-item:hover .mv-notif-close {
            opacity: 1;
        }
        .mv-notif-close:hover {
            background: #ef4444;
            color: white;
            transform: scale(1.1);
        }
        body.dark-mode .mv-notif-close {
            background: rgba(100,116,139,0.6);
            color: #f1f5f9;
        }
        body.dark-mode .mv-notif-close:hover {
            background: #ef4444;
        }
        .mv-notif-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(245,158,11,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: #f59e0b;
            font-size: 0.9rem;
        }
        .mv-notif-title {
            font-weight: 600;
            font-size: 0.82rem;
            color: #1e293b;
            line-height: 1.3;
        }
        body.dark-mode .mv-notif-title { color: #f1f5f9; }
        .mv-notif-desc {
            font-size: 0.75rem;
            color: #64748b;
            margin-top: 2px;
        }
        body.dark-mode .mv-notif-desc { color: #94a3b8; }
        .mv-notif-empty {
            padding: 24px 16px;
            text-align: center;
            color: #94a3b8;
            font-size: 0.85rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .mv-notif-more {
            padding: 8px 16px;
            text-align: center;
            font-size: 0.78rem;
            color: #3b82f6;
            font-weight: 500;
        }
        .mv-notif-spinner {
            width: 24px; height: 24px;
            border: 3px solid rgba(59,130,246,0.2);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
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
})();
