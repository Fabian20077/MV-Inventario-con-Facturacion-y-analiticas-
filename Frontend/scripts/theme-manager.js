/* ============================================
   THEME MANAGER - Modo Oscuro (Fijo)
   ============================================ */

const ThemeManager = {
    init() {
        // Aplicar modo oscuro de forma permanente
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme-preference', 'dark');
    }
};

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

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-profile') && !e.target.closest('.user-profile-dropdown')) {
                dropdown.classList.remove('active');
            }
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => UserProfileManager.init(), 100);
    });
} else {
    setTimeout(() => UserProfileManager.init(), 100);
}
