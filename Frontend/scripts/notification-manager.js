/**
 * SISTEMA CENTRALIZADO DE NOTIFICACIONES
 * Gestiona notificaciones globales sincronizadas entre todas las pestañas
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.dismissedIds = [];
        this.STORAGE_KEY = 'mv_notifications';
        this.DISMISSED_KEY = 'mv_notifications_dismissed';
        this.init();
    }

    init() {
        // Cargar notificaciones y dismissed del localStorage
        this.loadFromStorage();
        
        // Escuchar cambios en localStorage (otras pestañas)
        window.addEventListener('storage', (e) => this.handleStorageChange(e));
        
        // Cargar notificaciones del servidor al iniciar
        this.loadFromServer();
        
        // Recargar cada 30 segundos
        setInterval(() => this.loadFromServer(), 30000);
    }

    /**
     * Cargar notificaciones del servidor
     */
    async loadFromServer() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) return;

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetch(window.location.origin + '/api/alertas/stock-bajo', { headers });
            const data = await response.json();
            const items = data.data || data || [];

            if (Array.isArray(items)) {
                // Convertir items a notificaciones
                let notifications = items.map((item, idx) => ({
                    id: `stock_${item.id || idx}`,
                    type: 'stock-bajo',
                    title: item.nombre || item.codigo,
                    quantity: Number(item.stock_actual) || Number(item.cantidad) || 0,
                    minimum: Number(item.stock_minimo) || 0,
                    timestamp: Date.now()
                }));

                // Filtrar las que fueron cerradas/dismissed
                notifications = notifications.filter(n => !this.dismissedIds.includes(n.id));

                this.setNotifications(notifications);
            }
        } catch (error) {
            console.error('Error cargando notificaciones del servidor:', error);
        }
    }

    /**
     * Establecer notificaciones y sincronizar
     */
    setNotifications(notifications) {
        this.notifications = notifications;
        this.saveToStorage();
        this.updateAllNavbars();
    }

    /**
     * Agregar una notificación
     */
    addNotification(notification) {
        if (!notification.id) {
            notification.id = 'notif_' + Date.now() + '_' + Math.random();
        }
        notification.timestamp = Date.now();
        
        const exists = this.notifications.some(n => n.id === notification.id);
        if (!exists) {
            this.notifications.push(notification);
            this.saveToStorage();
            this.updateAllNavbars();
        }
    }

    /**
     * Eliminar notificación por ID (la marca como dismissed)
     */
    removeNotification(notificationId) {
        // Agregar a dismissed
        if (!this.dismissedIds.includes(notificationId)) {
            this.dismissedIds.push(notificationId);
        }
        
        // Eliminar de la lista visible
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.saveToStorage();
        this.updateAllNavbars();
    }

    /**
     * Guardar en localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notifications));
            localStorage.setItem(this.DISMISSED_KEY, JSON.stringify(this.dismissedIds));
            // Disparar evento personalizado para otras pestañas
            window.dispatchEvent(new CustomEvent('notificationsUpdated', { 
                detail: { notifications: this.notifications, dismissedIds: this.dismissedIds } 
            }));
        } catch (error) {
            console.error('Error guardando notificaciones:', error);
        }
    }

    /**
     * Cargar desde localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.notifications = JSON.parse(stored);
            }
            
            const storedDismissed = localStorage.getItem(this.DISMISSED_KEY);
            if (storedDismissed) {
                this.dismissedIds = JSON.parse(storedDismissed);
            }
        } catch (error) {
            console.error('Error cargando notificaciones del storage:', error);
            this.notifications = [];
            this.dismissedIds = [];
        }
    }

    /**
     * Manejar cambios en localStorage (otras pestañas)
     */
    handleStorageChange(event) {
        if (event.key === this.STORAGE_KEY || event.key === this.DISMISSED_KEY) {
            this.loadFromStorage();
            this.updateAllNavbars();
        }
    }

    /**
     * Actualizar todos los navbars en la página
     */
    updateAllNavbars() {
        if (typeof window.updateNotificationUI === 'function') {
            window.updateNotificationUI(this.notifications);
        }
    }

    /**
     * Obtener todas las notificaciones
     */
    getAll() {
        return [...this.notifications];
    }

    /**
     * Obtener cantidad de notificaciones
     */
    getCount() {
        return this.notifications.length;
    }

    /**
     * Limpiar todas las notificaciones
     */
    clearAll() {
        this.notifications = [];
        this.dismissedIds = [];
        this.saveToStorage();
        this.updateAllNavbars();
    }

    /**
     * Obtener IDs de notificaciones cerradas/dismissed
     */
    getDismissedIds() {
        return [...this.dismissedIds];
    }
}

// Crear instancia global
window.notificationManager = new NotificationManager();
