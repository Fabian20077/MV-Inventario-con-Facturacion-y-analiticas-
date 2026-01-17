/* ============================================
   THEME TOGGLE - Dark Mode / Light Mode
   ============================================ */

const ThemeManager = {
    // Tema actual
    currentTheme: 'dark',

    // Inicializar tema
    init() {
        // Verificar preferencia guardada en localStorage
        const savedTheme = localStorage.getItem('theme-preference');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        this.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        this.applyTheme(this.currentTheme);
        this.setupToggle();
    },

    // Aplicar tema
    applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.remove('dark-mode');
            document.body.classList.remove('dark');
        } else {
            document.body.classList.add('dark-mode');
            document.body.classList.add('dark');
        }

        this.currentTheme = theme;
        localStorage.setItem('theme-preference', theme);

        // Actualizar icono del botón
        this.updateToggleIcon(theme);
    },

    // Actualizar icono del botón toggle
    updateToggleIcon(theme) {
        const toggleBtn = document.querySelector('.theme-toggle');
        if (!toggleBtn) return;

        if (theme === 'light') {
            toggleBtn.innerHTML = '<i class="bi bi-moon-fill"></i>';
            toggleBtn.title = 'Cambiar a Modo Oscuro';
        } else {
            toggleBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
            toggleBtn.title = 'Cambiar a Modo Claro';
        }
    },

    // Configurar evento del toggle
    setupToggle() {
        const toggleBtn = document.querySelector('.theme-toggle');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }
    },

    // Alternar tema
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => ThemeManager.init(), 100);
    });
} else {
    setTimeout(() => ThemeManager.init(), 100);
}

/* ============================================
   USER PROFILE DROPDOWN
   ============================================ */

const UserProfileManager = {
    init() {
        const profileBtn = document.querySelector('.user-profile');
        const dropdown = document.querySelector('.user-profile-dropdown');

        if (!profileBtn || !dropdown) return;

        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-profile') && !e.target.closest('.user-profile-dropdown')) {
                dropdown.classList.remove('active');
            }
        });

        // Cerrar dropdown al hacer click en un item
        const dropdownItems = dropdown.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                dropdown.classList.remove('active');
            });
        });
    }
};

// Inicializar profile dropdown
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => UserProfileManager.init(), 100);
    });
} else {
    setTimeout(() => UserProfileManager.init(), 100);
}
