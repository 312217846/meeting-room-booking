// ============================================================
// 会议室预订系统 - 统一前端入口
// ============================================================

// ---- API 客户端 ----
const API = {
    baseUrl: '',

    async request(url, options = {}) {
        const response = await fetch(this.baseUrl + url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
            credentials: 'include'
        });
        return response.json();
    },

    login: (phone, password) => API.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
    register: (data) => API.request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => API.request('/api/auth/logout', { method: 'POST' }),
    getMe: () => API.request('/api/user/me'),
    getRooms: () => API.request('/api/rooms'),
    getRoom: (id) => API.request(`/api/rooms/${id}`),
    createRoom: (data) => API.request('/api/rooms', { method: 'POST', body: JSON.stringify(data) }),
    updateRoom: (id, data) => API.request(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRoom: (id) => API.request(`/api/rooms/${id}`, { method: 'DELETE' }),
    getAllRooms: () => API.request('/api/rooms/all'),
    getBookings: (params) => API.request(`/api/bookings?${new URLSearchParams(params).toString()}`),
    checkAvailability: (params) => API.request(`/api/bookings/check-availability?${new URLSearchParams(params).toString()}`),
    createBooking: (data) => API.request('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
    cancelBooking: (id) => API.request(`/api/bookings/${id}/cancel`, { method: 'PUT' }),
    getTodayBookings: (date) => API.request(`/api/bookings/today${date ? '?date=' + date : ''}`),
    getUsers: (search = '') => API.request(`/api/admin/users${search ? '?' + new URLSearchParams({ search }).toString() : ''}`),
    updateUserRole: (id, role) => API.request(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    updateUser: (id, data) => API.request(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id) => API.request(`/api/admin/users/${id}`, { method: 'DELETE' }),
    toggleUserActive: (id) => API.request(`/api/admin/users/${id}/toggle-active`, { method: 'PUT' }),
    resetPassword: (id, newPassword) => API.request(`/api/admin/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
    importUsers: (text) => API.request('/api/admin/users/import', { method: 'POST', body: JSON.stringify({ text }) }),
    getStats: () => API.request('/api/admin/stats'),
    getLogs: () => API.request('/api/admin/logs'),
    getReports: (params) => API.request(`/api/admin/reports?${new URLSearchParams(params).toString()}`),
    exportReport: (type, year, month) => { window.open(API.baseUrl + `/api/admin/reports/export?${new URLSearchParams({ type, year, month }).toString()}`); },
    getWxAuthUrl: (redirectUri) => API.request(`/api/auth/wx-url?redirect_uri=${encodeURIComponent(redirectUri)}`),
    wxCallback: (code) => API.request(`/api/auth/wx-callback?code=${code}`)
};

// ---- 全局会议室数据 ----
let ROOMS_DATA = [];

const ROOM_TYPE_LABELS = {
    normal: '会议室',
    training: '培训室',
    vip: 'VIP室'
};

const BOOKING_PURPOSES = ['见客', '招募', '培训', '讲座', '会议', '其他'];
const MAX_BOOKING_DAYS = 365;
const BOOKING_START_MINUTES = 8 * 60;
const BOOKING_END_MINUTES = 20 * 60;
const BOOKING_SLOT_MINUTES = 30;

// ---- 应用主对象（唯一入口） ----
const app = {
    currentUser: null,
    previewMode: false,
    currentTab: 'rooms',
    roomFilter: 'all',
    roomTypeFilter: 'normal',
    selectedRoom: null,
    selectedDate: null,
    selectedTimeSlots: [],
    bookings: [],
    currentWeekStart: null,
    weekBookings: [],
    currentReportPeriod: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
    reportData: null,
    adminUsers: [],
    currentAdminTab: 'rooms',

    // ==================== 初始化 ====================
    async init() {
        this.currentWeekStart = this.getWeekStart(new Date());
        await this.loadData();
        this.generateDates();
        this.setupBookingAttendeeCountControl();
        this.updateSubmitButtonState();
        this.checkLoginStatus();
    },

    // ==================== 工具函数 ====================
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    timeToMinutes(time) {
        const match = String(time || '').trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        const second = Number(match[3] || 0);
        if (second !== 0) return null;
        if (hour === 24 && minute === 0 && second === 0) return 24 * 60;
        if (hour < 0 || hour > 23) return null;
        return hour * 60 + minute;
    },

    minutesToTime(minutes) {
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) return null;
        const hour = Math.floor(minutes / 60);
        const min = minutes % 60;
        return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    },

    getEndTime(startTime) {
        const startMinutes = this.timeToMinutes(startTime);
        if (startMinutes === null) return '';
        return this.minutesToTime(startMinutes + BOOKING_SLOT_MINUTES);
    },

    generateTimeSlots() {
        const slots = [];
        for (let minutes = BOOKING_START_MINUTES; minutes < BOOKING_END_MINUTES; minutes += BOOKING_SLOT_MINUTES) {
            slots.push(this.minutesToTime(minutes));
        }
        return slots;
    },

    normalizeRoomType(roomOrType) {
        const value = typeof roomOrType === 'string'
            ? roomOrType
            : (roomOrType?.room_type || roomOrType?.type || (this.normalizeDbFlag(roomOrType?.is_vip, false) ? 'vip' : 'normal'));
        return Object.prototype.hasOwnProperty.call(ROOM_TYPE_LABELS, value) ? value : 'normal';
    },

    normalizeDbFlag(value, fallback = true) {
        if (value === undefined || value === null) return fallback;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
        return Boolean(value);
    },

    parseBookingPermissions(value) {
        let permissions = [];
        if (Array.isArray(value)) {
            permissions = value;
        } else if (value) {
            try {
                const parsed = JSON.parse(value);
                permissions = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                permissions = String(value).split(',').map(item => item.trim()).filter(Boolean);
            }
        }
        const normalized = permissions
            .map(type => String(type || '').trim())
            .filter(type => Object.prototype.hasOwnProperty.call(ROOM_TYPE_LABELS, type));
        return [...new Set(normalized)];
    },

    getCurrentUserPermissions() {
        if (this.currentUser?.role === 'admin') return Object.keys(ROOM_TYPE_LABELS);
        const permissions = this.parseBookingPermissions(this.currentUser?.booking_permissions);
        return permissions.length > 0 ? permissions : ['normal'];
    },

    userCanBookRoom(room) {
        return this.getCurrentUserPermissions().includes(this.normalizeRoomType(room));
    },

    getRoomTypeLabel(roomOrType) {
        return ROOM_TYPE_LABELS[this.normalizeRoomType(roomOrType)] || ROOM_TYPE_LABELS.normal;
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    },

    getUserDisplayName(user) {
        const parts = [user.english_name || user.englishName, user.last_name || user.lastName]
            .map(part => String(part || '').trim())
            .filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : (user.name || '-');
    },

    formatBookingPermissions(value) {
        const permissions = this.parseBookingPermissions(value);
        return permissions.length > 0 ? permissions.map(type => this.getRoomTypeLabel(type)).join('、') : '-';
    },

    formatDailyBookingLimit(value) {
        if (value === null || value === undefined || value === '') return '不限';
        const minutes = Number(value);
        return Number.isFinite(minutes) ? `${minutes}分钟` : '-';
    },

    isDateWithinBookingHorizon(date, today = new Date()) {
        const target = new Date(date);
        const start = new Date(today);
        target.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        const maxDate = new Date(start);
        maxDate.setDate(start.getDate() + MAX_BOOKING_DAYS);
        return target >= start && target <= maxDate;
    },

    updateRoomTypeFilterButtons() {
        document.querySelectorAll('#roomTypeFilter [data-room-type]').forEach(button => {
            const selected = button.dataset.roomType === this.roomTypeFilter;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    },

    setRoomTypeFilter(type) {
        this.roomTypeFilter = this.normalizeRoomType(type);
        this.updateRoomTypeFilterButtons();
        if (this.selectedRoom && (this.normalizeRoomType(this.selectedRoom) !== this.roomTypeFilter || !this.userCanBookRoom(this.selectedRoom))) {
            this.selectedRoom = null;
            this.selectedTimeSlots = [];
        }
        this.renderRoomSelect();
        this.renderTimeSlots();
        this.updateSubmitButtonState();
    },

    getBookingOccupantLabel(booking) {
        const profileParts = [booking.region, booking.groupName || booking.group_name, booking.englishName || booking.english_name, booking.lastName || booking.last_name]
            .map(part => String(part || '').trim())
            .filter(Boolean);
        return profileParts.length > 0 ? profileParts.join(' ') : (booking.userName || booking.user_name || '');
    },

    isSlotOccupied(slotTime, booking) {
        const slotStartMinutes = this.timeToMinutes(slotTime);
        const bookingStartMinutes = this.timeToMinutes(booking.startTime || booking.start_time);
        const bookingEndMinutes = this.timeToMinutes(booking.endTime || booking.end_time);
        return slotStartMinutes !== null && bookingStartMinutes !== null && bookingEndMinutes !== null &&
            slotStartMinutes >= bookingStartMinutes && slotStartMinutes < bookingEndMinutes;
    },

    getSortedTimeSlots(slots) {
        return [...slots].sort((a, b) => this.timeToMinutes(a) - this.timeToMinutes(b));
    },

    isContiguousSlotSelection(slots) {
        const sortedSlots = this.getSortedTimeSlots(slots);
        return sortedSlots.every((slot, index) => {
            if (this.timeToMinutes(slot) === null) return false;
            if (index === 0) return true;
            return this.timeToMinutes(slot) - this.timeToMinutes(sortedSlots[index - 1]) === BOOKING_SLOT_MINUTES;
        });
    },

    canToggleTimeSlot(time) {
        const targetMinutes = this.timeToMinutes(time);
        const sortedSlots = this.getSortedTimeSlots(this.selectedTimeSlots);
        if (targetMinutes === null) return { allowed: false, message: '时间段格式无效，请重新选择' };

        const selectedIndex = sortedSlots.indexOf(time);
        if (selectedIndex > -1) {
            if (sortedSlots.length <= 1) return { allowed: true };
            const firstMinutes = this.timeToMinutes(sortedSlots[0]);
            const lastMinutes = this.timeToMinutes(sortedSlots[sortedSlots.length - 1]);
            if (targetMinutes === firstMinutes || targetMinutes === lastMinutes) return { allowed: true };
            return { allowed: false, message: '只能从已选时间段的两端取消，请保持连续选择' };
        }

        if (sortedSlots.length === 0) return { allowed: true };
        if (!this.isContiguousSlotSelection(sortedSlots)) return { allowed: false, message: '已选时间段不连续，请重新选择' };

        const firstMinutes = this.timeToMinutes(sortedSlots[0]);
        const lastMinutes = this.timeToMinutes(sortedSlots[sortedSlots.length - 1]);
        if (targetMinutes === firstMinutes - BOOKING_SLOT_MINUTES || targetMinutes === lastMinutes + BOOKING_SLOT_MINUTES) return { allowed: true };
        return { allowed: false, message: '请选择相邻的时间段，预订时间必须连续' };
    },

    showToast(message, type = 'info') {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;font-size:14px;color:white;z-index:10000;animation:fadeIn 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.15);background:${type === 'success' ? '#4A9D5B' : type === 'error' ? '#C0392B' : '#333'};`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3000);
    },

    // ==================== 登录/注册 ====================
    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    },

    showLoginForm() {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    },

    isLocalPreviewHost() {
        const location = window.location || {};
        const host = location.hostname || '';
        return !host || ['localhost', '127.0.0.1', '::1'].includes(host);
    },

    shouldUseInstantPreviewLogin() {
        const location = window.location || {};
        if (location.protocol === 'file:') return true;
        try {
            const params = new URLSearchParams(location.search || '');
            return this.isLocalPreviewHost() || (params.get('preview') === '1' && this.isLocalPreviewHost());
        } catch (error) {
            return false;
        }
    },

    getPreviewUser() {
        return {
            id: 1,
            name: '默认管理员',
            phone: '+852 0000 0000',
            avatar: 'P',
            role: 'admin',
            booking_permissions: ['normal', 'training', 'vip'],
            daily_booking_limit_minutes: null,
            is_active: true,
            preview_mode: true
        };
    },

    getPreviewRooms() {
        return [
            { id: 1, name: 'Harbour Crystal Room', room_type: 'normal', type: 'normal', capacity: 8, floor: '26F', location: '维港景观区', equipment: ['电视屏', '白板', '视频会议'], is_active: true },
            { id: 2, name: 'Golden Training Suite', room_type: 'training', type: 'training', capacity: 28, floor: '26F', location: '培训中心', equipment: ['投影', '音响', '移动桌椅'], is_active: true },
            { id: 3, name: 'Executive VIP Lounge', room_type: 'vip', type: 'vip', capacity: 12, floor: '26F', location: '贵宾洽谈区', equipment: ['双屏', '茶水吧', '视频会议'], is_active: true }
        ];
    },

    getPreviewUsers() {
        return [
            this.getPreviewUser(),
            { id: 2, name: '陈小曼', phone: '+852 6123 4567', avatar: '陈', role: 'premium', region: '香港', group_name: 'Agency A', booking_permissions: ['normal', 'training'], daily_booking_limit_minutes: 240, is_active: true },
            { id: 3, name: '林志豪', phone: '+852 6234 5678', avatar: '林', role: 'normal', region: '九龙', group_name: 'Agency B', booking_permissions: ['normal'], daily_booking_limit_minutes: 120, is_active: true }
        ];
    },

    getPreviewBookings(date = this.formatDate(new Date())) {
        return [
            { id: 101, room_id: 1, roomId: 1, room_name: 'Harbour Crystal Room', booking_date: date, date, start_time: '09:00', startTime: '09:00', end_time: '10:30', endTime: '10:30', user_name: '陈小曼', title: '见客', status: 'confirmed', attendee_count: 4, created_at: `${date}T08:30:00` },
            { id: 102, room_id: 2, roomId: 2, room_name: 'Golden Training Suite', booking_date: date, date, start_time: '14:00', startTime: '14:00', end_time: '16:00', endTime: '16:00', user_name: '林志豪', title: '培训', status: 'confirmed', attendee_count: 22, created_at: `${date}T09:10:00` }
        ];
    },

    getPreviewReportData() {
        const year = this.currentReportPeriod.year;
        const month = this.currentReportPeriod.month;
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const rooms = this.getPreviewRooms();
        const users = this.getPreviewUsers();
        const roomUsage = [
            { ...rooms[0], booking_count: 12, total_minutes: 960 },
            { ...rooms[1], booking_count: 9, total_minutes: 1080 },
            { ...rooms[2], booking_count: 5, total_minutes: 420 }
        ];
        const userUsage = [
            { ...users[1], user_name: users[1].name, booking_count: 10, total_minutes: 780 },
            { ...users[2], user_name: users[2].name, booking_count: 8, total_minutes: 660 },
            { ...users[0], user_name: users[0].name, booking_count: 4, total_minutes: 360 }
        ];
        const bookingUsage = [
            { title: '见客', room_type: 'normal', booking_count: 10, total_minutes: 720 },
            { title: '培训', room_type: 'training', booking_count: 8, total_minutes: 960 },
            { title: '会议', room_type: 'normal', booking_count: 5, total_minutes: 420 },
            { title: '讲座', room_type: 'vip', booking_count: 3, total_minutes: 360 }
        ];
        const dailyCounts = [0, 2, 1, 0, 3, 4, 0, 1, 2, 0, 5, 1, 0, 2, 3, 0, 1, 4, 2, 0, 3, 1, 0, 2, 4, 0, 1, 2];
        const totalMinutes = roomUsage.reduce((sum, item) => sum + item.total_minutes, 0);
        const totalBookings = roomUsage.reduce((sum, item) => sum + item.booking_count, 0);

        return {
            totalStats: {
                totalBookings,
                totalHours: Math.round(totalMinutes / 60 * 10) / 10,
                avgDuration: Math.round(totalMinutes / totalBookings),
                totalAttendees: 186,
                avgAttendees: 7,
                activeUsers: userUsage.length,
                activeRooms: roomUsage.length,
                peakDay: `${monthPrefix}-11`,
                peakHour: '14:00'
            },
            attendeeStats: {
                totalAttendees: 186,
                avgAttendees: 7,
                maxAttendees: 28
            },
            roomUsage,
            userUsage,
            bookingUsage,
            roomTypeUsage: [
                { room_type: 'normal', booking_count: 15, total_minutes: 1380 },
                { room_type: 'training', booking_count: 9, total_minutes: 1080 },
                { room_type: 'vip', booking_count: 5, total_minutes: 420 }
            ],
            regionUsage: [
                { region: '香港', booking_count: 15, total_minutes: 1140 },
                { region: '九龙', booking_count: 8, total_minutes: 660 }
            ],
            groupUsage: [
                { group_name: 'Agency A', booking_count: 12, total_minutes: 900 },
                { group_name: 'Agency B', booking_count: 9, total_minutes: 720 }
            ],
            hourlyUsage: [
                { hour: 9, booking_count: 4 },
                { hour: 10, booking_count: 3 },
                { hour: 14, booking_count: 8 },
                { hour: 15, booking_count: 5 },
                { hour: 17, booking_count: 2 }
            ],
            dailyTrend: dailyCounts.map((count, index) => ({
                booking_date: `${monthPrefix}-${String(index + 1).padStart(2, '0')}`,
                booking_count: count
            }))
        };
    },

    primePreviewData() {
        this.previewMode = true;
        ROOMS_DATA = this.getPreviewRooms();
        this.adminUsers = this.getPreviewUsers();
        this.bookings = this.getPreviewBookings();
    },

    async handlePreviewLogin() {
        this.primePreviewData();
        const user = this.getPreviewUser();
        this.currentUser = user;
        try { localStorage.setItem('currentUser', JSON.stringify(user)); } catch (error) {}
        await this.handleLoginSuccess(user);
        this.showToast('已进入预览模式', 'success');
    },

    async handleLogin() {
        if (this.shouldUseInstantPreviewLogin()) {
            await this.handlePreviewLogin();
            return;
        }

        const phone = document.getElementById('loginPhone')?.value.trim() || '';
        const password = document.getElementById('loginPassword')?.value || '';
        if (!phone || !password) { this.showToast('请输入手机号和密码', 'error'); return; }
        const triggerEvent = typeof event !== 'undefined' ? event : null;
        const btn = triggerEvent?.target?.closest('button');
        if (btn) { btn.classList.add('btn-loading'); btn.textContent = '登录中...'; }
        try {
            const res = await API.login(phone, password);
            if (res.code === 0) {
                this.currentUser = res.data.user;
                localStorage.setItem('currentUser', JSON.stringify(res.data.user));
                this.showToast('登录成功', 'success');
                await this.handleLoginSuccess(res.data.user);
            } else {
                this.showToast(res.message || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showToast('登录失败，请重试', 'error');
        } finally {
            if (btn) { btn.classList.remove('btn-loading'); btn.textContent = '登 录'; }
        }
    },

    async handleRegister() {
        const name = document.getElementById('regName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const gender = document.querySelector('input[name="gender"]:checked')?.value;
        if (!name || !phone || !password) { this.showToast('请填写完整信息', 'error'); return; }
        if (password.length < 6) { this.showToast('密码长度至少6位', 'error'); return; }
        try {
            const res = await API.register({ name, phone, password, gender });
            if (res.code === 0) {
                this.currentUser = res.data.user;
                localStorage.setItem('currentUser', JSON.stringify(res.data.user));
                this.showToast(res.message || '注册成功', 'success');
                await this.handleLoginSuccess(res.data.user);
            } else {
                this.showToast(res.message || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册失败:', error);
            this.showToast('注册失败，请重试', 'error');
        }
    },

    async handleLogout() {
        try { await API.logout(); } catch (e) {}
        this.currentUser = null;
        this.previewMode = false;
        localStorage.removeItem('currentUser');
        ROOMS_DATA = [];
        document.getElementById('loginPage').style.display = '';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginPhone').value = '';
        document.getElementById('loginPassword').value = '';
    },

    // ==================== 登录成功 → 显示主应用 ====================
    async handleLoginSuccess(user) {
        this.currentUser = user;
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.updateUserDisplay();
        this.generateDates();

        // 加载会议室
        await this.loadRoomsData();

        // 渲染
        this.renderRooms();

        // 管理员
        if (user.role === 'admin') {
            this.renderAdminRoomTable();
            this.renderAdminUserTable();
            this.updateStats();
        }

        this.switchTab('booking');
    },

    // ==================== 数据加载 ====================
    async loadRoomsData() {
        if (this.previewMode) {
            ROOMS_DATA = this.getPreviewRooms();
            return;
        }
        try {
            const res = await API.getRooms();
            if (res.code === 0) {
                ROOMS_DATA = res.data.map(room => ({
                    ...room,
                    room_type: this.normalizeRoomType(room),
                    type: this.normalizeRoomType(room),
                    equipment: typeof room.equipment === 'string' ? JSON.parse(room.equipment || '[]') : (room.equipment || [])
                }));
            }
        } catch (error) { console.error('加载会议室数据失败:', error); }
    },

    async loadData() {
        if (this.shouldUseInstantPreviewLogin()) {
            this.previewMode = true;
            ROOMS_DATA = this.getPreviewRooms();
            try {
                const saved = localStorage.getItem('currentUser');
                const savedUser = saved ? JSON.parse(saved) : null;
                if (savedUser?.preview_mode) this.currentUser = this.getPreviewUser();
            } catch (error) {}
            return;
        }
        try {
            const res = await API.getMe();
            if (res.code === 0) this.currentUser = res.data;
        } catch (e) {
            const saved = localStorage.getItem('currentUser');
            if (saved) {
                this.currentUser = JSON.parse(saved);
                if (this.currentUser?.preview_mode) this.primePreviewData();
            }
        }
        await this.loadRoomsData();
    },

    // ==================== 用户显示 ====================
    updateUserDisplay() {
        if (!this.currentUser) return;
        const avatar = this.currentUser.avatar || this.currentUser.name.charAt(0);
        const $ = id => document.getElementById(id);
        $('userAvatar').textContent = avatar;
        $('userName').textContent = this.currentUser.name;
        if ($('pcUserAvatar')) $('pcUserAvatar').textContent = avatar;
        if ($('pcUserName')) $('pcUserName').textContent = this.currentUser.name;

        const badge = $('userBadge');
        badge.className = 'header-badge ' + this.currentUser.role;
        let roleText = '👑 银色';
        if (this.currentUser.role === 'admin') {
            roleText = 'ADMIN';
            if ($('pcUserBadge')) $('pcUserBadge').textContent = 'ADMIN';
        } else if (this.currentUser.role === 'premium') {
            roleText = '👑 金色';
            if ($('pcUserBadge')) $('pcUserBadge').innerHTML = '👑 金色';
        } else {
            if ($('pcUserBadge')) $('pcUserBadge').innerHTML = '👑 银色';
        }
        badge.innerHTML = roleText;

        if (this.currentUser.role === 'normal') $('permissionBanner').style.display = 'flex';
        else $('permissionBanner').style.display = 'none';

        if (this.currentUser.role === 'admin') {
            $('adminNavItem').style.display = 'flex';
            $('pcAdminNavItem').style.display = 'flex';
        } else {
            $('adminNavItem').style.display = 'none';
            $('pcAdminNavItem').style.display = 'none';
        }
    },

    checkLoginStatus() {
        if (this.currentUser) this.showMainApp();
    },

    showMainApp() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.updateUserDisplay();
        this.renderRooms();
        this.generateDates();
        this.updateStats();
    },

    closePermissionBanner() { document.getElementById('permissionBanner').style.display = 'none'; },

    // ==================== Tab 切换 ====================
    switchTab(tab) {
        this.currentTab = tab;
        const tabs = ['rooms', 'booking', 'myBookings', 'admin'];
        document.querySelectorAll('.bottom-nav .nav-item').forEach((item, i) => {
            item.classList.toggle('active', tabs[i] === tab);
        });
        document.querySelectorAll('.pc-nav-item').forEach((item, i) => {
            item.classList.toggle('active', tabs[i] === tab);
        });
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(tab + 'Page').classList.add('active');
        const titles = { rooms: '会议室列表', booking: '预订会议室', myBookings: '我的预订', admin: '系统管理' };
        const pt = document.getElementById('pageTitle');
        if (pt) pt.textContent = titles[tab];

        if (tab === 'rooms') this.renderRooms();
        else if (tab === 'booking') { this.updateRoomTypeFilterButtons(); this.renderRoomSelect(); this.renderTimeSlots(); this.updateSubmitButtonState(); }
        else if (tab === 'myBookings') this.renderMyBookings();
        else if (tab === 'admin') this.switchAdminTab('rooms');
    },

    // ==================== 会议室列表渲染 ====================
    async renderRooms() {
        const container = document.getElementById('roomList');
        if (!container) return;
        if (this._renderingRooms) return; // 防止重复渲染
        this._renderingRooms = true;
        container.innerHTML = '';

        if (ROOMS_DATA.length === 0) await this.loadRoomsData();
        if (!this.currentUser) return;

        const todayStr = this.formatDate(new Date());
        const nowHour = new Date().getHours();
        const nowMin = new Date().getMinutes();
        const nowMinutes = nowHour * 60 + nowMin;

        let todayBookings = [];
        if (this.previewMode) {
            todayBookings = this.getPreviewBookings(todayStr);
        } else {
            try {
                const res = await API.getTodayBookings(todayStr);
                if (res.code === 0) todayBookings = res.data;
            } catch (e) {}
        }

        ROOMS_DATA.forEach(room => {
            const roomType = this.normalizeRoomType(room);
            const isVip = roomType === 'vip';
            const isLocked = !this.userCanBookRoom(room);
            const roomTypeLabel = this.getRoomTypeLabel(roomType);
            if (this.roomFilter === 'available' && isLocked) return;

            // 解析设备列表
            let equipment = room.equipment;
            if (typeof equipment === 'string') {
                try { equipment = JSON.parse(equipment); } catch(e) { equipment = equipment.split(',').map(s => s.trim()).filter(s => s); }
            }
            if (!Array.isArray(equipment)) equipment = [];

            // 今日时间轴
            const roomBookings = todayBookings.filter(b => (b.room_id || b.roomId) === room.id);
            let timelineBlocks = '', statusTag = '', occupiedMinutes = 0;
            const dayStart = 480, dayEnd = 1080, dayTotal = 600;

            roomBookings.forEach(b => {
                const bookingStart = this.timeToMinutes(b.start_time || b.startTime || '08:00');
                const bookingEnd = this.timeToMinutes(b.end_time || b.endTime || '09:00');
                if (bookingStart === null || bookingEnd === null) return;
                const sMin = Math.max(bookingStart, dayStart);
                const eMin = Math.min(bookingEnd, dayEnd);
                if (eMin > sMin) {
                    occupiedMinutes += (eMin - sMin);
                    const leftPct = ((sMin - dayStart) / dayTotal * 100).toFixed(2);
                    const widthPct = ((eMin - sMin) / dayTotal * 100).toFixed(2);
                    const tip = `${(b.start_time || b.startTime || '').substring(0, 5)}-${(b.end_time || b.endTime || '').substring(0, 5)} ${b.user_name || b.userName || ''}`;
                    timelineBlocks += `<div class="tl-block" style="left:${leftPct}%;width:${widthPct}%" data-tip="${tip}"></div>`;
                }
            });

            const occupiedRatio = occupiedMinutes / dayTotal;
            const isBusy = roomBookings.some(b => {
                const bookingStart = this.timeToMinutes(b.start_time || b.startTime || '08:00');
                const bookingEnd = this.timeToMinutes(b.end_time || b.endTime || '09:00');
                return bookingStart !== null && bookingEnd !== null && nowMinutes >= bookingStart && nowMinutes < bookingEnd;
            });
            statusTag = occupiedRatio >= 0.7 ? '<span class="room-status-tag full">已满</span>' :
                         isBusy ? '<span class="room-status-tag busy">使用中</span>' :
                         '<span class="room-status-tag free">空闲</span>';

            const card = document.createElement('div');
            card.className = `room-card ${isVip ? 'vip' : ''} ${isLocked ? 'locked' : ''}`;
            const eqHtml = equipment.map(e => `<span class="equipment-tag">${e}</span>`).join('');
            card.innerHTML = `
                ${isLocked ? '<div class="room-lock-overlay"><div class="room-lock-icon">🔒</div></div>' : ''}
                <div class="room-header">
                    <div class="room-name-section">
                        <span class="room-name">${room.name}</span>
                        <span class="room-vip-badge">${roomTypeLabel}</span>
                        ${statusTag}
                    </div>
                    <span class="room-capacity">👥 ${room.capacity}人</span>
                </div>
                <div class="room-info">
                    <div class="room-location">📍 ${room.location || room.floor || ''}</div>
                    <div class="room-equipment">${eqHtml}</div>
                </div>
                <div class="room-timeline-bar">${timelineBlocks}</div>
                <div class="room-timeline-labels"><span>08:00</span><span>12:00</span><span>18:00</span></div>`;
            card.onclick = () => this.handleRoomClick(room);
            container.appendChild(card);
        });
        this._renderingRooms = false;
    },

    handleRoomClick(room) {
        if (!this.userCanBookRoom(room)) {
            this.showVipSheet();
        } else {
            this.selectedRoom = room;
            this.roomTypeFilter = this.normalizeRoomType(room);
            this.selectedDate = this.formatDate(new Date());
            this.selectedTimeSlots = [];
            this.switchTab('booking');
        }
    },

    // ==================== VIP Sheet ====================
    showVipSheet() { document.getElementById('vipSheet').classList.add('show'); },
    hideVipSheet(event) { if (!event || event.target === event.currentTarget) document.getElementById('vipSheet').classList.remove('show'); },
    applyForUpgrade() { this.hideVipSheet(); this.showToast('申请已提交，请等待管理员审核', 'success'); },

    // ==================== 预订页 ====================
    generateDates() {
        const container = document.getElementById('dateSelector');
        if (!container) return;
        const today = new Date();
        today.setHours(0,0,0,0);
        const todayStr = this.formatDate(today);
        const days = ['日', '一', '二', '三', '四', '五', '六'];

        if (!this.selectedDate) this.selectedDate = todayStr;

        const selDate = new Date(this.selectedDate + 'T00:00:00');
        let viewYear = selDate.getFullYear();
        let viewMonth = selDate.getMonth();

        const renderCalendar = () => {
            const firstDay = new Date(viewYear, viewMonth, 1).getDay();
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

            let html = `<div class="calendar-nav">
                <button class="cal-nav-btn" id="calPrev">‹</button>
                <span class="cal-title">${viewYear}年${viewMonth + 1}月</span>
                <button class="cal-nav-btn" id="calNext">›</button>
            </div>`;
            html += '<div class="cal-weekdays">';
            days.forEach(d => html += `<div class="cal-wd">${d}</div>`);
            html += '</div><div class="cal-days">';

            for (let i = 0; i < firstDay; i++) {
                html += `<div class="cal-day other-month">${prevMonthDays - firstDay + 1 + i}</div>`;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(viewYear, viewMonth, d);
                const dateStr = this.formatDate(date);
                const isDisabled = !this.isDateWithinBookingHorizon(date, today);
                const isSelected = dateStr === this.selectedDate;
                const isToday = dateStr === todayStr;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const cls = ['cal-day'];
                if (isDisabled) cls.push('disabled');
                if (isSelected) cls.push('selected');
                if (isToday) cls.push('today');
                if (isWeekend && !isDisabled) cls.push('weekend');
                html += `<div class="${cls.join(' ')}" data-date="${dateStr}" ${isDisabled ? '' : `onclick="app.selectCalendarDate('${dateStr}')"`}>${d}</div>`;
            }

            const totalCells = firstDay + daysInMonth;
            const remaining = (7 - totalCells % 7) % 7;
            for (let i = 1; i <= remaining; i++) {
                html += `<div class="cal-day other-month">${i}</div>`;
            }
            html += '</div>';
            container.innerHTML = html;

            document.getElementById('calPrev').onclick = () => {
                viewMonth--;
                if (viewMonth < 0) { viewMonth = 11; viewYear--; }
                renderCalendar();
            };
            document.getElementById('calNext').onclick = () => {
                viewMonth++;
                if (viewMonth > 11) { viewMonth = 0; viewYear++; }
                renderCalendar();
            };
        };
        renderCalendar();
    },

    selectCalendarDate(dateStr) {
        this.selectedDate = dateStr;
        this.selectedTimeSlots = [];
        this.generateDates();
        this.renderTimeSlots();
    },

    renderRoomSelect() {
        const container = document.getElementById('roomSelectContainer');
        if (!container) return;
        if (!this.selectedRoom) {
            container.innerHTML = '<div class="room-select-list" id="roomSelectList"></div>';
            this.renderRoomSelectList();
        } else {
            const roomType = this.normalizeRoomType(this.selectedRoom);
            const isVip = roomType === 'vip';
            const roomTypeLabel = this.getRoomTypeLabel(roomType);
            const equipment = Array.isArray(this.selectedRoom.equipment) ? this.selectedRoom.equipment : [];
            const eqHtml = equipment.map(e => `<span>${e}</span>`).join('');
            container.innerHTML = `
                <div class="room-selected-card ${isVip ? 'vip' : ''}">
                    <div class="room-selected-header">
                        <span class="room-selected-name">${this.selectedRoom.name}</span>
                        <span class="room-selected-badge">${roomTypeLabel}</span>
                    </div>
                    <div class="room-selected-meta">📍 ${this.selectedRoom.location || this.selectedRoom.floor || ''} · 👥 ${this.selectedRoom.capacity}人</div>
                    <div class="room-selected-equipment">${eqHtml}</div>
                    <button class="room-change-btn" onclick="app.expandRoomSelect()">更换</button>
                </div>`;
        }
    },

    expandRoomSelect() {
        const container = document.getElementById('roomSelectContainer');
        container.innerHTML = '<div class="room-select-list" id="roomSelectList"></div>';
        this.renderRoomSelectList();
    },

    async renderRoomSelectList() {
        const container = document.getElementById('roomSelectList');
        if (!container) return;
        if (ROOMS_DATA.length === 0) await this.loadRoomsData();
        container.innerHTML = '';
        const rooms = ROOMS_DATA.filter(room => this.normalizeRoomType(room) === this.roomTypeFilter);
        if (rooms.length === 0) {
            container.innerHTML = `<div class="time-slot-placeholder">暂无${this.getRoomTypeLabel(this.roomTypeFilter)}</div>`;
            return;
        }
        rooms.forEach(room => {
            const roomType = this.normalizeRoomType(room);
            const isVip = roomType === 'vip';
            const roomTypeLabel = this.getRoomTypeLabel(roomType);
            const isLocked = !this.userCanBookRoom(room);
            const isSelected = this.selectedRoom?.id === room.id;
            const item = document.createElement('div');
            item.className = `room-select-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`;
            item.innerHTML = `<div class="room-select-info"><div class="room-select-name">${room.name} <span style="color:${isVip ? 'var(--vip-gold)' : 'var(--primary-dark)'}">${roomTypeLabel}</span></div><div class="room-select-meta">${room.location || room.floor || ''} · ${room.capacity}人</div></div>${isLocked ? '<span style="color:var(--text-secondary)">🔒</span>' : ''}`;
            if (!isLocked) {
                item.onclick = () => { this.selectedRoom = room; this.selectedTimeSlots = []; this.renderRoomSelect(); this.renderTimeSlots(); this.updateSubmitButtonState(); };
            }
            container.appendChild(item);
        });
    },

    async renderTimeSlots() {
        const container = document.getElementById('timeGrid');
        if (!container) return;
        container.innerHTML = '';
        if (!this.selectedRoom) { container.innerHTML = '<div class="time-slot-placeholder">请先选择会议室</div>'; return; }
        let existingBookings = [];
        if (this.previewMode) {
            existingBookings = this.getPreviewBookings(this.selectedDate)
                .filter(b => (b.room_id || b.roomId) === this.selectedRoom.id)
                .map(b => ({
                    roomId: b.room_id,
                    date: b.booking_date,
                    startTime: b.start_time,
                    endTime: b.end_time,
                    userName: b.user_name,
                    status: b.status
                }));
        } else {
            try {
                const res = await API.getBookings({ room_id: this.selectedRoom.id, date: this.selectedDate });
                if (res.code === 0) existingBookings = res.data.map(b => ({
                    roomId: b.room_id,
                    date: b.booking_date,
                    startTime: b.start_time,
                    endTime: b.end_time,
                    userName: b.user_name,
                    englishName: b.english_name,
                    lastName: b.last_name,
                    region: b.region,
                    groupName: b.group_name,
                    status: b.status
                }));
            } catch (e) { console.error('获取预订数据失败:', e); }
        }

        const now = new Date();
        const todayStr = this.formatDate(now);
        const isToday = this.selectedDate === todayStr;

        this.generateTimeSlots().forEach(time => {
            const slotStartMinutes = this.timeToMinutes(time);
            const endTime = this.getEndTime(time);
            const slot = document.createElement('div');
            slot.dataset.time = time;

            const isPast = isToday && slotStartMinutes !== null && slotStartMinutes <= now.getHours() * 60 + now.getMinutes();
            const booking = existingBookings.find(b => this.isSlotOccupied(time, b));
            const slotLabel = `<span>${time}</span><span class="booker-name">${time} - ${endTime}</span>`;

            if (isPast) {
                slot.className = 'time-slot past';
                slot.innerHTML = `<span>${time}</span><span class="booker-name">已过</span>`;
            } else if (booking) {
                slot.className = 'time-slot occupied';
                slot.innerHTML = `<span>${time}</span><span class="booker-name">${this.getBookingOccupantLabel(booking)}</span>`;
            } else if (this.selectedTimeSlots.includes(time)) {
                slot.className = 'time-slot selected';
                slot.innerHTML = slotLabel;
                slot.onclick = () => this.toggleTimeSlot(time, slot);
            } else {
                slot.className = 'time-slot available';
                slot.innerHTML = slotLabel;
                slot.onclick = () => this.toggleTimeSlot(time, slot);
            }
            container.appendChild(slot);
        });
    },

    toggleTimeSlot(time, element) {
        if (element.classList.contains('occupied')) return;
        const toggleResult = this.canToggleTimeSlot(time);
        if (!toggleResult.allowed) {
            this.showToast(toggleResult.message, 'error');
            return;
        }

        const idx = this.selectedTimeSlots.indexOf(time);
        if (idx > -1) {
            this.selectedTimeSlots.splice(idx, 1);
            element.className = 'time-slot available';
        } else {
            this.selectedTimeSlots.push(time);
            this.selectedTimeSlots = this.getSortedTimeSlots(this.selectedTimeSlots);
            element.className = 'time-slot selected';
        }
        this.updateSubmitButtonState();
    },

    updateSubmitButtonState() {
        const btn = document.getElementById('submitBookingBtn');
        if (!btn) return;
        btn.disabled = !(this.selectedRoom && this.selectedDate && this.selectedTimeSlots.length > 0);
    },

    setupBookingAttendeeCountControl() {
        const input = document.getElementById('bookingAttendeeCount');
        const value = document.getElementById('bookingAttendeeCountValue');
        if (!input || !value || input.dataset.bound === 'true') return;

        const syncValue = () => { value.textContent = input.value; };
        syncValue();
        input.addEventListener('input', syncValue);
        input.dataset.bound = 'true';
    },

    resetBookingInfoControls() {
        const defaultPurpose = document.querySelector('input[name="bookingPurpose"][value="见客"]') ||
            document.querySelector('input[name="bookingPurpose"]');
        if (defaultPurpose) defaultPurpose.checked = true;

        const attendeeCount = document.getElementById('bookingAttendeeCount');
        const attendeeCountValue = document.getElementById('bookingAttendeeCountValue');
        if (attendeeCount) attendeeCount.value = '1';
        if (attendeeCountValue) attendeeCountValue.textContent = attendeeCount?.value || '1';
    },

    // ==================== 提交预订 ====================
    async submitBooking() {
        if (!this.selectedRoom) { this.showError('请选择会议室', '请先选择一个会议室'); return; }
        if (this.selectedTimeSlots.length === 0) { this.showError('请选择时间段', '请至少选择一个时间段'); return; }
        const title = document.querySelector('input[name="bookingPurpose"]:checked')?.value;
        const attendeeCount = Number.parseInt(document.getElementById('bookingAttendeeCount')?.value || '1', 10);
        if (!title || !BOOKING_PURPOSES.includes(title)) { this.showError('请选择用途', '请选择本次预订用途'); return; }
        if (!Number.isInteger(attendeeCount) || attendeeCount < 1 || attendeeCount > 200) { this.showError('人数无效', '预计人数需在1到200之间'); return; }
        if (!this.userCanBookRoom(this.selectedRoom)) { this.showError('权限不足', `您没有预订${this.getRoomTypeLabel(this.selectedRoom)}的权限`); return; }
        if (!this.isContiguousSlotSelection(this.selectedTimeSlots)) { this.showError('时间段不连续', '请选择连续的时间段后再提交'); return; }

        this.selectedTimeSlots = this.getSortedTimeSlots(this.selectedTimeSlots);
        const startTime = this.selectedTimeSlots[0];
        const endTime = this.getEndTime(this.selectedTimeSlots[this.selectedTimeSlots.length - 1]);

        try {
            const res = await API.createBooking({
                room_id: this.selectedRoom.id, booking_date: this.selectedDate,
                start_time: startTime, end_time: endTime, title,
                attendee_count: attendeeCount
            });
            if (res.code === 0) {
                this.resetBookingInfoControls();
                this.selectedRoom = null;
                this.selectedTimeSlots = [];
                this.renderRoomSelect();
                this.renderTimeSlots();
                this.updateSubmitButtonState();
                this.showSuccess();
                this.renderRooms();
                this.updateStats();
                setTimeout(() => { this.hideSuccessModal(); this.switchTab('myBookings'); }, 1500);
            } else { this.showError('预订失败', res.message || '请检查预订信息'); }
        } catch (error) {
            console.error('创建预订失败:', error);
            this.showError('预订失败', '网络错误，请稍后重试');
        }
    },

    // ==================== 弹窗 ====================
    showSuccess() { document.getElementById('successModal').classList.add('show'); },
    hideSuccessModal(event) { if (!event || event.target === event.currentTarget) document.getElementById('successModal').classList.remove('show'); },
    showError(title, message) { document.getElementById('errorTitle').textContent = title; document.getElementById('errorMessage').textContent = message; document.getElementById('errorModal').classList.add('show'); },
    hideErrorModal(event) { if (!event || event.target === event.currentTarget) document.getElementById('errorModal').classList.remove('show'); },

    // ==================== 我的预订 ====================
    async renderMyBookings() {
        const container = document.getElementById('myBookingsList');
        if (!container) return;
        container.innerHTML = '';
        let myBookings = [];
        if (this.previewMode) {
            myBookings = this.getPreviewBookings().map(b => ({
                id: b.id,
                roomName: b.room_name,
                roomType: this.normalizeRoomType(ROOMS_DATA.find(room => room.id === b.room_id) || 'normal'),
                date: b.booking_date,
                startTime: b.start_time,
                endTime: b.end_time,
                title: b.title,
                status: 'upcoming',
                createdAt: b.created_at
            }));
        } else {
            try {
                const res = await API.getBookings({});
                if (res.code === 0) {
                    myBookings = res.data.map(b => ({
                        id: b.id, roomName: b.room_name,
                        roomType: b.room_name && b.room_name.includes('VIP') ? 'vip' : 'normal',
                        date: b.booking_date, startTime: b.start_time, endTime: b.end_time,
                        title: b.title, status: b.status === 'confirmed' ? 'upcoming' : b.status, createdAt: b.created_at
                    }));
                }
            } catch (error) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">加载失败，请稍后重试</div></div>';
                return;
            }
        }
        if (myBookings.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">暂无预订记录</div></div>';
            return;
        }
        myBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        container.innerHTML = myBookings.map(booking => {
            const isVip = booking.roomType === 'vip';
            const statusText = { upcoming: '即将进行', completed: '已完成', cancelled: '已取消' }[booking.status] || booking.status;
            const isExpired = new Date(booking.date + 'T' + booking.endTime) < new Date();
            const canCancel = booking.status === 'upcoming' && !isExpired;
            const d = new Date(booking.date);
            return `
                <div class="booking-card ${isVip ? 'vip' : ''}">
                    <div class="booking-header">
                        <span class="booking-room">${booking.roomName} ${isVip ? '<span style="color:var(--vip-gold)">VIP</span>' : ''}</span>
                        <span class="booking-status ${booking.status}">${statusText}</span>
                    </div>
                    <div class="booking-info">
                        <div class="booking-info-item">📅 ${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}</div>
                        <div class="booking-info-item">⏰ ${booking.startTime} - ${booking.endTime}</div>
                        <div class="booking-info-item">📝 ${booking.title}</div>
                    </div>
                    ${canCancel ? `<div class="booking-actions"><button class="booking-btn danger" onclick="app.cancelBookingById(${booking.id})">取消预订</button></div>` : ''}
                </div>`;
        }).join('');
    },

    async cancelBookingById(bookingId) {
        if (!confirm('确定要取消这个预订吗？')) return;
        try {
            const res = await API.cancelBooking(bookingId);
            if (res.code === 0) { this.renderMyBookings(); this.renderRooms(); this.updateStats(); this.showToast('取消成功', 'success'); }
            else this.showError('取消失败', res.message || '请稍后重试');
        } catch (error) { this.showError('取消失败', '网络错误，请稍后重试'); }
    },

    // ==================== 统计 ====================
    async updateStats() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;
        if (this.previewMode) {
            const map = {
                statTotalRooms: this.getPreviewRooms().length,
                statTotalBookings: this.getPreviewBookings().length,
                statTotalUsers: this.getPreviewUsers().length,
                statVipUsers: this.getPreviewUsers().filter(user => user.role === 'premium' || user.role === 'admin').length
            };
            Object.entries(map).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
            return;
        }
        try {
            const res = await API.getStats();
            if (res.code === 0) {
                const s = res.data;
                const map = { statTotalRooms: 'totalRooms', statTotalBookings: 'todayBookings', statTotalUsers: 'totalUsers', statVipUsers: 'vipUsers' };
                Object.entries(map).forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.textContent = s[key] || 0; });
            }
        } catch (e) { console.error('获取统计数据失败:', e); }
    },

    // ==================== 管理员 Tab ====================
    switchAdminTab(tab) {
        this.currentAdminTab = tab;
        document.querySelectorAll('.admin-tab').forEach(btn => { btn.classList.toggle('active', btn.dataset.tab === tab); });
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`adminTab-${tab}`).classList.add('active');
        if (tab === 'rooms') this.renderAdminRoomTable();
        else if (tab === 'users') this.renderAdminUserTable();
        else if (tab === 'reports') this.loadReports();
    },

    async renderAdminRoomTable() {
        const tbody = document.getElementById('adminRoomTableBody');
        if (!tbody) return;
        let rooms = [];
        if (this.previewMode) {
            rooms = this.getPreviewRooms();
        } else {
            try { const res = await API.getAllRooms(); if (res.code === 0) rooms = res.data; } catch (e) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px">加载失败</td></tr>';
                this.renderAdminRoomCards([]);
                return;
            }
        }
        this.renderAdminRoomCards(rooms);
        tbody.innerHTML = rooms.map(room => {
            const eq = typeof room.equipment === 'string' ? JSON.parse(room.equipment || '[]') : (room.equipment || []);
            const eqStr = eq.slice(0, 3).join(', ') + (eq.length > 3 ? '...' : '');
            const roomType = this.normalizeRoomType(room);
            const isActive = this.normalizeDbFlag(room.is_active);
            return `<tr class="room-table-row">
                <td><strong>${room.name}</strong></td><td>${roomType === 'vip' ? '<span class="vip-badge-small">VIP</span>' : this.getRoomTypeLabel(roomType)}</td><td>${room.capacity}人</td><td>${room.floor || '-'}</td><td>${room.location || '-'}</td><td>${eqStr}</td>
                <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '启用' : '停用'}</span></td>
                <td class="room-table-actions"><div class="admin-action-group">
                    <button class="admin-action-btn admin-action-edit" onclick="app.editRoom(${room.id})">编辑</button>
                    <button class="admin-action-btn admin-action-danger" onclick="app.confirmDeleteRoom(${room.id})">删除</button>
                </div></td></tr>`;
        }).join('');
    },

    renderAdminRoomCards(rooms = []) {
        const container = document.getElementById('adminRoomCards');
        if (!container) return;
        if (!rooms.length) {
            container.innerHTML = '<div class="mobile-admin-card"><div class="mobile-card-title">暂无会议室</div><div class="mobile-card-meta">创建会议室后会显示在这里</div></div>';
            return;
        }
        container.innerHTML = rooms.map(room => {
            let eq = [];
            try {
                eq = typeof room.equipment === 'string' ? JSON.parse(room.equipment || '[]') : (room.equipment || []);
            } catch (e) {
                eq = [];
            }
            const roomType = this.normalizeRoomType(room);
            const isActive = this.normalizeDbFlag(room.is_active);
            const equipment = eq.length ? eq.slice(0, 3).join(' / ') : '未填写';
            return `<article class="mobile-admin-card">
                <div class="mobile-card-head">
                    <div>
                        <div class="mobile-card-title">${this.escapeHtml(room.name || '-')}</div>
                        <div class="mobile-card-meta">${this.escapeHtml(room.floor || '-')} · ${this.escapeHtml(room.location || '-')}</div>
                    </div>
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '启用' : '停用'}</span>
                </div>
                <div class="mobile-card-grid">
                    <div class="mobile-card-field">类型<strong>${roomType === 'vip' ? 'VIP室' : this.escapeHtml(this.getRoomTypeLabel(roomType))}</strong></div>
                    <div class="mobile-card-field">容量<strong>${this.escapeHtml(room.capacity || 0)}人</strong></div>
                    <div class="mobile-card-field">设备<strong>${this.escapeHtml(equipment)}</strong></div>
                    <div class="mobile-card-field">状态<strong>${isActive ? '可预订' : '已停用'}</strong></div>
                </div>
                <div class="mobile-card-actions">
                    <button class="admin-action-btn admin-action-edit" onclick="app.editRoom(${room.id})">编辑</button>
                    <button class="admin-action-btn admin-action-danger" onclick="app.confirmDeleteRoom(${room.id})">删除</button>
                </div>
            </article>`;
        }).join('');
    },

    async renderAdminUserTable() {
        const tbody = document.getElementById('adminUserTableBody');
        if (!tbody) return;
        const search = document.getElementById('adminUserSearch')?.value.trim() || '';
        let users = [];
        if (this.previewMode) {
            users = this.getPreviewUsers().filter(user => {
                const text = `${user.name || ''} ${user.phone || ''} ${user.region || ''} ${user.group_name || ''}`.toLowerCase();
                return text.includes(search.toLowerCase());
            });
            this.adminUsers = users;
        } else {
            try {
                const res = await API.getUsers(search);
                if (res.code === 0) users = Array.isArray(res.data) ? res.data : (res.data?.users || []);
                this.adminUsers = users;
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:40px">加载失败</td></tr>';
                this.renderAdminUserCards([]);
                return;
            }
        }
        this.renderAdminUserCards(users);
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--text-secondary)">暂无用户</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(user => {
            const displayName = this.getUserDisplayName(user);
            const avatarText = user.avatar || String(user.name || displayName || '?').charAt(0);
            const canDelete = user.role !== 'admin' || user.id !== this.currentUser?.id;
            const isActive = this.normalizeDbFlag(user.is_active);
            return `<tr>
            <td><div class="user-table-avatar">${this.escapeHtml(avatarText)}</div></td>
            <td><strong>${this.escapeHtml(user.name || '-')}</strong></td>
            <td>${this.escapeHtml(displayName)}</td>
            <td>${this.escapeHtml(user.phone || '-')}</td>
            <td><select class="role-select" onchange="app.changeUserRole(${user.id}, this.value)">
                <option value="normal" ${user.role === 'normal' ? 'selected' : ''}>普通员工</option>
                <option value="premium" ${user.role === 'premium' ? 'selected' : ''}>高级员工</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option></select></td>
            <td>${this.escapeHtml(user.region || '-')}</td>
            <td>${this.escapeHtml(user.group_name || user.groupName || '-')}</td>
            <td>${this.escapeHtml(this.formatBookingPermissions(user.booking_permissions))}</td>
            <td>${this.escapeHtml(this.formatDailyBookingLimit(user.daily_booking_limit_minutes))}</td>
            <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '正常' : '禁用'}</span></td>
            <td><button class="admin-action-btn admin-action-reset" onclick="app.resetUserPassword(${user.id})">重置</button></td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
            <td><div class="admin-action-group">
                <button class="admin-action-btn admin-action-edit" onclick="app.editUser(${user.id})">编辑</button>
                <button class="admin-action-btn admin-action-toggle" onclick="app.toggleUserActive(${user.id})">${isActive ? '禁用' : '启用'}</button>
                ${canDelete ? `<button class="admin-action-btn admin-action-danger" onclick="app.confirmDeleteUser(${user.id})">删除</button>` : ''}
            </div></td></tr>`;
        }).join('');
    },

    renderAdminUserCards(users = []) {
        const container = document.getElementById('adminUserCards');
        if (!container) return;
        if (!users.length) {
            container.innerHTML = '<div class="mobile-admin-card"><div class="mobile-card-title">暂无用户</div><div class="mobile-card-meta">导入或搜索用户后会显示在这里</div></div>';
            return;
        }
        container.innerHTML = users.map(user => {
            const displayName = this.getUserDisplayName(user);
            const canDelete = user.role !== 'admin' || user.id !== this.currentUser?.id;
            const isActive = this.normalizeDbFlag(user.is_active);
            return `<article class="mobile-admin-card">
                <div class="mobile-card-head">
                    <div>
                        <div class="mobile-card-title">${this.escapeHtml(user.name || '-')}</div>
                        <div class="mobile-card-meta">${this.escapeHtml(displayName)} · ${this.escapeHtml(user.phone || '-')}</div>
                    </div>
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '正常' : '禁用'}</span>
                </div>
                <div class="mobile-card-grid">
                    <div class="mobile-card-field">地区<strong>${this.escapeHtml(user.region || '-')}</strong></div>
                    <div class="mobile-card-field">组别<strong>${this.escapeHtml(user.group_name || user.groupName || '-')}</strong></div>
                    <div class="mobile-card-field">权限<strong>${this.escapeHtml(this.formatBookingPermissions(user.booking_permissions))}</strong></div>
                    <div class="mobile-card-field">每日上限<strong>${this.escapeHtml(this.formatDailyBookingLimit(user.daily_booking_limit_minutes))}</strong></div>
                </div>
                <div class="mobile-card-actions">
                    <select class="role-select" onchange="app.changeUserRole(${user.id}, this.value)">
                        <option value="normal" ${user.role === 'normal' ? 'selected' : ''}>普通员工</option>
                        <option value="premium" ${user.role === 'premium' ? 'selected' : ''}>高级员工</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option>
                    </select>
                    <button class="admin-action-btn admin-action-edit" onclick="app.editUser(${user.id})">编辑</button>
                    <button class="admin-action-btn admin-action-toggle" onclick="app.toggleUserActive(${user.id})">${isActive ? '禁用' : '启用'}</button>
                    <button class="admin-action-btn admin-action-reset" onclick="app.resetUserPassword(${user.id})">重置密码</button>
                    ${canDelete ? `<button class="admin-action-btn admin-action-danger" onclick="app.confirmDeleteUser(${user.id})">删除</button>` : ''}
                </div>
            </article>`;
        }).join('');
    },

    // ==================== 会议室编辑弹窗 ====================
    showRoomEditModal(room = null) {
        try {
            const modal = document.getElementById('roomEditModal');
            if (!modal) { alert('弹窗元素不存在'); return; }
            document.getElementById('roomEditTitle').textContent = room ? '编辑会议室' : '新建会议室';
            document.getElementById('roomEditId').value = room ? room.id : '';
            document.getElementById('roomEditName').value = room ? room.name : '';
            document.getElementById('roomEditCapacity').value = room ? room.capacity : '10';
            document.getElementById('roomEditFloor').value = room ? (room.floor || '') : '';
            document.getElementById('roomEditLocation').value = room ? (room.location || '') : '';
            document.getElementById('roomEditEquipment').value = room ? (Array.isArray(room.equipment) ? room.equipment.join(', ') : (typeof room.equipment === 'string' ? room.equipment : '')) : '';
            document.getElementById('roomEditDescription').value = room ? (room.description || '') : '';
            const roomType = room ? this.normalizeRoomType(room) : 'normal';
            document.getElementById('roomEditType').value = roomType;
            document.getElementById('roomEditIsVip').checked = roomType === 'vip';
            document.getElementById('roomEditIsActive').checked = room ? this.normalizeDbFlag(room.is_active) : true;
            modal.style.display = 'flex';
        } catch(e) { alert('弹窗错误: ' + e.message); }
    },

    closeRoomEditModal() {
        const modal = document.getElementById('roomEditModal');
        modal.classList.remove("show");
        modal.style.display = 'none';
    },

    async handleRoomSubmit(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('roomEditId').value;
        const roomType = this.normalizeRoomType(document.getElementById('roomEditType')?.value || (document.getElementById('roomEditIsVip').checked ? 'vip' : 'normal'));
        const data = {
            name: document.getElementById('roomEditName').value,
            capacity: parseInt(document.getElementById('roomEditCapacity').value),
            floor: document.getElementById('roomEditFloor').value,
            location: document.getElementById('roomEditLocation').value,
            equipment: document.getElementById('roomEditEquipment').value.split(',').map(s => s.trim()).filter(s => s),
            description: document.getElementById('roomEditDescription').value,
            room_type: roomType,
            is_vip: roomType === 'vip',
            is_active: document.getElementById('roomEditIsActive').checked
        };
        try {
            const res = id ? await API.updateRoom(id, data) : await API.createRoom(data);
            if (res.code === 0) { this.closeRoomEditModal(); await this.loadRoomsData(); this.renderRooms(); this.renderAdminRoomTable(); this.showToast(id ? '会议室已更新' : '会议室已创建', 'success'); }
            else this.showError('保存失败', res.message || '请稍后重试');
        } catch (error) { this.showError('保存失败', '网络错误，请稍后重试'); }
    },

    async editRoom(roomId) {
        try { const res = await API.getAllRooms(); if (res.code === 0) { const room = res.data.find(r => r.id === roomId); if (room) this.showRoomEditModal(room); } } catch (e) { this.showError('加载失败', '无法加载会议室信息'); }
    },

    async confirmDeleteRoom(roomId) {
        if (!confirm('确定要删除这个会议室吗？')) return;
        try {
            const res = await API.deleteRoom(roomId);
            if (res.code === 0) { this.showToast('删除成功', 'success'); await this.loadRoomsData(); this.renderRooms(); this.renderAdminRoomTable(); }
            else this.showError('删除失败', res.message || '请稍后重试');
        } catch (e) { this.showError('删除失败', '网络错误，请稍后重试'); }
    },

    async changeUserRole(userId, newRole) {
        try { const res = await API.updateUserRole(userId, newRole); if (res.code === 0) { this.showToast('更新成功', 'success'); this.renderAdminUserTable(); } else this.showError('更新失败', res.message); } catch (e) { this.showError('更新失败', '网络错误'); }
    },

    async editUser(userId) {
        const search = document.getElementById('adminUserSearch')?.value.trim() || '';
        let user = this.adminUsers.find(item => item.id === userId);
        if (!user) {
            try {
                const res = await API.getUsers(search);
                const users = res.code === 0 ? (Array.isArray(res.data) ? res.data : (res.data?.users || [])) : [];
                user = users.find(item => item.id === userId);
            } catch (e) {
                this.showError('加载失败', '无法加载用户信息');
                return;
            }
        }
        if (!user) { this.showError('加载失败', '未找到用户'); return; }

        const promptValue = (label, value) => {
            const nextValue = prompt(label, value ?? '');
            return nextValue === null ? null : nextValue.trim();
        };
        const data = {};
        const fields = [
            ['name', '姓名', user.name],
            ['phone', '手机', user.phone],
            ['role', '角色（normal/premium/admin）', user.role || 'normal'],
            ['gender', '性别', user.gender || ''],
            ['english_name', '英文名', user.english_name || user.englishName || ''],
            ['last_name', '英文姓氏', user.last_name || user.lastName || ''],
            ['region', '地区', user.region || ''],
            ['group_name', '组别', user.group_name || user.groupName || '']
        ];
        for (const [key, label, value] of fields) {
            const nextValue = promptValue(label, value);
            if (nextValue === null) return;
            data[key] = nextValue;
        }

        const permissionsValue = promptValue('预订权限（normal,training,vip，用逗号分隔）', this.parseBookingPermissions(user.booking_permissions).join(','));
        if (permissionsValue === null) return;
        data.booking_permissions = this.parseBookingPermissions(permissionsValue);

        const limitValue = promptValue('每日预订上限（分钟，留空为不限）', user.daily_booking_limit_minutes ?? '');
        if (limitValue === null) return;
        data.daily_booking_limit_minutes = limitValue === '' ? null : Number(limitValue);
        if (limitValue !== '' && (!Number.isFinite(data.daily_booking_limit_minutes) || data.daily_booking_limit_minutes < 0)) {
            this.showError('更新失败', '每日上限必须是非负数字');
            return;
        }

        const activeValue = promptValue('是否启用（true/false）', this.normalizeDbFlag(user.is_active) ? 'true' : 'false');
        if (activeValue === null) return;
        data.is_active = !['false', '0', 'no', '否', '禁用'].includes(activeValue.toLowerCase());

        try {
            const res = await API.updateUser(userId, data);
            if (res.code === 0) {
                this.showToast('用户已更新', 'success');
                this.renderAdminUserTable();
            } else {
                this.showError('更新失败', res.message || '请稍后重试');
            }
        } catch (e) {
            this.showError('更新失败', '网络错误');
        }
    },

    async toggleUserActive(userId) {
        try {
            const res = await API.toggleUserActive(userId);
            if (res.code === 0) {
                this.showToast('用户状态已更新', 'success');
                this.renderAdminUserTable();
            } else {
                this.showError('更新失败', res.message || '请稍后重试');
            }
        } catch (e) {
            this.showError('更新失败', '网络错误');
        }
    },

    async resetUserPassword(userId) {
        const newPassword = prompt('请输入新密码');
        if (newPassword === null) return;
        if (!newPassword.trim()) { this.showError('重置失败', '新密码不能为空'); return; }
        try {
            const res = await API.resetPassword(userId, newPassword.trim());
            if (res.code === 0) this.showToast('密码已重置', 'success');
            else this.showError('重置失败', res.message || '请稍后重试');
        } catch (e) {
            this.showError('重置失败', '网络错误');
        }
    },

    async importUsersFromText() {
        const textarea = document.getElementById('userImportText');
        const text = textarea?.value.trim() || '';
        if (!text) { this.showError('导入失败', '请先粘贴用户数据'); return; }
        try {
            const res = await API.importUsers(text);
            if (res.code === 0) {
                const result = res.data || {};
                const imported = result.imported ?? result.created ?? result.success ?? 0;
                const updated = result.updated ?? 0;
                const skipped = result.skipped ?? 0;
                const errors = Array.isArray(result.errors) ? result.errors : [];
                this.showToast(`导入完成：新增${imported}，更新${updated}，跳过${skipped}`, errors.length ? 'info' : 'success');
                if (errors.length) alert(`导入错误：\n${errors.join('\n')}`);
                this.renderAdminUserTable();
            } else {
                this.showError('导入失败', res.message || '请检查导入数据');
            }
        } catch (e) {
            this.showError('导入失败', '网络错误');
        }
    },

    importUsersFromFile() {
        const input = document.getElementById('userImportFile');
        const textarea = document.getElementById('userImportText');
        const file = input?.files?.[0];
        if (!file) { this.showError('导入失败', '请选择导入文件'); return; }
        const reader = new FileReader();
        reader.onload = async () => {
            if (textarea) textarea.value = String(reader.result || '');
            await this.importUsersFromText();
        };
        reader.onerror = () => this.showError('导入失败', '无法读取文件');
        reader.readAsText(file);
    },

    async confirmDeleteUser(userId) {
        if (!confirm('确定要删除这个用户吗？此操作不可撤销。')) return;
        try { const res = await API.deleteUser(userId); if (res.code === 0) { this.showToast('删除成功', 'success'); this.renderAdminUserTable(); } else this.showError('删除失败', res.message); } catch (e) { this.showError('删除失败', '网络错误'); }
    },

    // ==================== 报告 ====================
    async loadReports() {
        if (this.previewMode || this.shouldUseInstantPreviewLogin()) {
            this.previewMode = true;
            this.reportData = this.getPreviewReportData();
            this.renderReports();
            return;
        }
        try {
            const res = await API.getReports({ year: this.currentReportPeriod.year, month: this.currentReportPeriod.month });
            if (res.code === 0) { this.reportData = res.data; this.renderReports(); }
        } catch (e) { console.error('加载报告失败:', e); }
    },

    renderReports() {
        if (!this.reportData) return;
        const periodEl = document.getElementById('reportPeriod');
        if (periodEl) periodEl.textContent = `${this.currentReportPeriod.year}年${this.currentReportPeriod.month}月`;
        this.renderReportHeroMetrics();
        this.renderReportKpis();
        this.renderReportInsightStrip();
        this.renderReportAttendeeInsight();

        const rooms = this.reportData.roomUsage || this.reportData.rooms || [];
        this.renderReportRanking(document.getElementById('roomUsageChart'), '会议室使用排行', rooms, room => `${room.name || room.room_name || '-'} · ${this.getRoomTypeLabel(room)}`);

        const users = this.reportData.userUsage || this.reportData.users || [];
        this.renderReportRanking(document.getElementById('userUsageChart'), '用户使用排行', users, user => {
            const profile = [user.region, user.group_name || user.groupName, user.english_name || user.englishName, user.last_name || user.lastName]
                .map(part => String(part || '').trim())
                .filter(Boolean)
                .join(' ');
            return profile ? `${user.name || user.user_name || '-'} · ${profile}` : (user.name || user.user_name || '-');
        }, 'linear-gradient(90deg,#4A90D9,#357ABD)');

        const bookings = this.reportData.bookingUsage || this.reportData.bookingReports || this.reportData.bookings || [];
        this.renderReportDonut(document.getElementById('reportPurposeChart'), '用途分布', bookings, booking => booking.title || '-');
        this.renderReportRanking(document.getElementById('bookingUsageChart'), '预订排行', bookings, booking => booking.title || booking.room_name || booking.roomName || booking.date || booking.booking_date || '-');
        this.renderReportDonut(document.getElementById('reportRoomTypeChart'), '房型占比', this.reportData.roomTypeUsage || [], item => this.getRoomTypeLabel(item.room_type || item));
        this.renderReportRanking(document.getElementById('reportRegionChart'), '地区排行', this.reportData.regionUsage || [], item => item.region || '未填写', 'linear-gradient(90deg,#8FBFE8,#4A90D9)');
        this.renderReportRanking(document.getElementById('reportGroupChart'), '组别排行', this.reportData.groupUsage || [], item => item.group_name || item.groupName || '未填写', 'linear-gradient(90deg,#C7A6FF,#7F62FF)');
        this.renderReportTimeHeatmap();
        this.renderReportTrend();
    },

    getReportCount(item) {
        return Number(item?.booking_count ?? item?.total_bookings ?? item?.count ?? 0);
    },

    getReportPalette() {
        return ['#C9A96E', '#31BFA6', '#4A90D9', '#7F62FF', '#E08AB8', '#9C7B3C'];
    },

    renderReportDonut(container, title, items, labelBuilder) {
        if (!container) return;
        const rankedItems = (items || []).filter(item => this.getReportCount(item) > 0).slice(0, 6);
        if (rankedItems.length === 0) {
            container.innerHTML = `<div class="report-card-title">${title}</div><div style="text-align:center;padding:34px;color:var(--text-secondary)">暂无数据</div>`;
            return;
        }

        const total = rankedItems.reduce((sum, item) => sum + this.getReportCount(item), 0);
        const palette = this.getReportPalette();
        let offset = 0;
        const segments = rankedItems.map((item, index) => {
            const count = this.getReportCount(item);
            const percent = total > 0 ? count / total * 100 : 0;
            const segment = `<circle class="report-donut-ring report-donut-segment" cx="18" cy="18" r="15.9155" pathLength="100" stroke="${palette[index % palette.length]}" stroke-dasharray="${percent.toFixed(2)} ${(100 - percent).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"></circle>`;
            offset += percent;
            return segment;
        }).join('');

        container.innerHTML = `<div class="report-card-title">${title}</div>
            <div class="report-donut-chart">
                <div class="report-donut-wrap">
                    <svg class="report-donut-svg" viewBox="0 0 36 36" role="img" aria-label="${this.escapeHtml(title)}圆盘图">
                        <circle class="report-donut-ring report-donut-track" cx="18" cy="18" r="15.9155"></circle>
                        <g transform="rotate(-90 18 18)">${segments}</g>
                    </svg>
                    <div class="report-donut-center">
                        <div class="report-donut-total">${this.escapeHtml(total)}</div>
                        <div class="report-donut-label">总计</div>
                    </div>
                </div>
                <div class="report-donut-legend">${rankedItems.map((item, index) => {
                    const count = this.getReportCount(item);
                    const percent = total > 0 ? Math.round(count / total * 100) : 0;
                    return `<div class="report-donut-legend-item">
                        <span class="report-donut-dot" style="background:${palette[index % palette.length]}"></span>
                        <span class="report-donut-name">${this.escapeHtml(labelBuilder(item))}</span>
                        <span class="report-donut-percent">${percent}%</span>
                    </div>`;
                }).join('')}</div>
            </div>`;
    },

    renderReportLineChart(container, title, trend) {
        if (!container) return;
        const values = (trend || []).map(item => Number(item.booking_count || 0));
        if (values.length === 0 || Math.max(...values) === 0) {
            container.innerHTML = `<div class="report-card-title">${title}</div><div style="text-align:center;padding:34px;color:var(--text-secondary)">暂无数据</div>`;
            return;
        }

        const width = 340, height = 156, padX = 18, padY = 18;
        const max = Math.max(...values);
        const step = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0;
        const points = values.map((value, index) => {
            const x = padX + step * index;
            const y = height - padY - (value / max) * (height - padY * 2);
            return { x, y, value, label: String((trend[index]?.booking_date || '')).slice(5) };
        });
        const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
        const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padY} L ${points[0].x.toFixed(1)} ${height - padY} Z`;
        const activePoints = points.filter(point => point.value > 0);
        const pointStep = Math.max(1, Math.ceil(activePoints.length / 8));
        const axisLabels = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].filter(Boolean);

        container.innerHTML = `<div class="report-card-title">${title}</div>
            <div class="report-card-subtitle">按日期查看当前月份预订热度</div>
            <div class="report-line-chart">
                <svg class="report-line-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${this.escapeHtml(title)}曲线图">
                    <defs>
                        <linearGradient id="reportLineGoldStroke" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stop-color="#E5C983"></stop>
                            <stop offset="50%" stop-color="#C9A96E"></stop>
                            <stop offset="100%" stop-color="#9C7B3C"></stop>
                        </linearGradient>
                        <linearGradient id="reportLineGoldArea" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stop-color="#E5C983" stop-opacity="0.34"></stop>
                            <stop offset="100%" stop-color="#E5C983" stop-opacity="0.02"></stop>
                        </linearGradient>
                    </defs>
                    <line class="report-line-grid" x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}"></line>
                    <line class="report-line-grid" x1="${padX}" y1="${height / 2}" x2="${width - padX}" y2="${height / 2}"></line>
                    <line class="report-line-grid" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
                    <path class="report-line-area" d="${areaPath}"></path>
                    <path class="report-line-path" d="${linePath}"></path>
                    ${activePoints.filter((_, index) => index % pointStep === 0).map(point => `<circle class="report-line-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${this.escapeHtml(point.label)} ${point.value}次</title></circle>`).join('')}
                </svg>
                <div class="report-line-axis">${axisLabels.map(point => `<span>${this.escapeHtml(point.label)}</span>`).join('')}</div>
                <div class="report-line-meta"><span>峰值 ${this.escapeHtml(max)} 次</span><span>走势曲线</span></div>
            </div>`;
    },

    renderReportRanking(container, title, items, labelBuilder, barColor = 'var(--primary)') {
        if (!container) return;
        const rankedItems = (items || []).filter(item => this.getReportCount(item) > 0);
        if (rankedItems.length === 0) {
            container.innerHTML = `<div class="report-card-title">${title}</div><div style="text-align:center;padding:34px;color:var(--text-secondary)">暂无数据</div>`;
            return;
        }
        const max = Math.max(...rankedItems.map(item => this.getReportCount(item)));
        container.innerHTML = `<div class="report-card-title">${title}</div><div class="chart-container">${rankedItems.slice(0, 10).map((item, i) => {
            const count = this.getReportCount(item);
            const minutes = Number(item.total_minutes || 0);
            const hoursText = minutes > 0 ? ` · ${Math.round(minutes / 60 * 10) / 10}h` : '';
            return `<div class="chart-row"><div class="chart-label">${i + 1}. ${this.escapeHtml(labelBuilder(item))}</div><div class="chart-bar-wrapper"><div class="chart-bar" style="width:${count / max * 100}%;background:${barColor}"></div><span class="chart-value">${count}次${hoursText}</span></div></div>`;
        }).join('')}</div>`;
    },

    renderReportHeroMetrics() {
        const container = document.getElementById('reportHeroMetrics');
        if (!container || !this.reportData) return;
        const stats = this.reportData.totalStats || {};
        const attendeeStats = this.reportData.attendeeStats || {};
        const metrics = [
            ['总预订', stats.totalBookings || 0, '当前月份', 'primary'],
            ['总时长', `${stats.totalHours || 0}h`, `平均 ${stats.avgDuration || 0} 分钟`, ''],
            ['参与人数', stats.totalAttendees || attendeeStats.totalAttendees || 0, `单场平均 ${stats.avgAttendees || attendeeStats.avgAttendees || 0} 人`, ''],
            ['热门时段', stats.peakHour || '-', '高峰预约时间', '']
        ];
        container.innerHTML = metrics.map(([label, value, sub, tone]) => `
            <div class="report-hero-metric ${tone}">
                <div class="report-hero-metric-value">${this.escapeHtml(value)}</div>
                <div class="report-hero-metric-label">${this.escapeHtml(label)} · ${this.escapeHtml(sub)}</div>
            </div>
        `).join('');
    },

    renderReportKpis() {
        const container = document.getElementById('reportKpiGrid');
        if (!container || !this.reportData) return;
        const stats = this.reportData.totalStats || {};
        const attendeeStats = this.reportData.attendeeStats || {};
        const countActive = items => (items || []).filter(item => Number(item.booking_count ?? item.total_bookings ?? item.count ?? 0) > 0).length;
        const activeUsers = stats.activeUsers ?? countActive(this.reportData.userUsage || this.reportData.users);
        const activeRooms = stats.activeRooms ?? countActive(this.reportData.roomUsage || this.reportData.rooms);
        const cards = [
            ['总预订', stats.totalBookings || 0, '当前月份确认预订'],
            ['总时长', `${stats.totalHours || 0}h`, `平均 ${stats.avgDuration || 0} 分钟`],
            ['参与人数', stats.totalAttendees || attendeeStats.totalAttendees || 0, `单场平均 ${stats.avgAttendees || attendeeStats.avgAttendees || 0} 人`],
            ['活跃用户', activeUsers || 0, '有预订记录的用户'],
            ['使用房间', activeRooms || 0, stats.peakDay ? `峰值 ${stats.peakDay}` : '当前月份'],
            ['热门时段', stats.peakHour || '-', '按开始时间统计']
        ];
        container.innerHTML = cards.map(([label, value, sub]) => `
            <div class="report-kpi-card">
                <div class="report-kpi-value">${this.escapeHtml(value)}</div>
                <div class="report-kpi-label">${this.escapeHtml(label)}</div>
                <div class="report-kpi-sub">${this.escapeHtml(sub)}</div>
            </div>
        `).join('');
    },

    renderReportInsightStrip() {
        const container = document.getElementById('reportInsightStrip');
        if (!container || !this.reportData) return;
        const stats = this.reportData.totalStats || {};
        const attendeeStats = this.reportData.attendeeStats || {};
        const insights = [
            ['峰值日期', stats.peakDay || '暂无', '当天所有房间合计'],
            ['峰值时段', stats.peakHour || '暂无', '按预订开始时间'],
            ['最大单场', `${attendeeStats.maxAttendees || stats.maxAttendees || 0}人`, '客户填写人数']
        ];
        container.innerHTML = insights.map(([label, value, sub]) => `
            <div class="report-insight-item">
                <div class="report-card-subtitle">${this.escapeHtml(label)}</div>
                <div class="report-insight-value">${this.escapeHtml(value)}</div>
                <div class="report-kpi-sub">${this.escapeHtml(sub)}</div>
            </div>
        `).join('');
    },

    renderReportAttendeeInsight() {
        const container = document.getElementById('reportAttendeeInsight');
        if (!container || !this.reportData) return;
        const stats = this.reportData.attendeeStats || this.reportData.totalStats || {};
        container.innerHTML = `<div class="report-card-title">参与人数洞察</div>
            <div class="mobile-card-grid">
                <div class="mobile-card-field">总参与<strong>${this.escapeHtml(stats.totalAttendees || 0)}人</strong></div>
                <div class="mobile-card-field">单场平均<strong>${this.escapeHtml(stats.avgAttendees || 0)}人</strong></div>
                <div class="mobile-card-field">最大单场<strong>${this.escapeHtml(stats.maxAttendees || 0)}人</strong></div>
                <div class="mobile-card-field">数据来源<strong>客户填写</strong></div>
            </div>`;
    },

    renderReportTimeHeatmap() {
        const container = document.getElementById('reportTimeHeatmapChart');
        if (!container || !this.reportData) return;
        const hourlyUsage = this.reportData.hourlyUsage || [];
        const countByHour = new Map(hourlyUsage.map(item => [Number(item.hour), this.getReportCount(item)]));
        const max = Math.max(0, ...Array.from(countByHour.values()));
        const hours = Array.from({ length: 12 }, (_, index) => index + 8);
        container.innerHTML = `<div class="report-card-title">热门时段热力</div>
            <div class="report-card-subtitle">08:00-20:00 办公预约时段</div>
            <div class="report-hour-grid">${hours.map(hour => {
                const count = countByHour.get(hour) || 0;
                const hot = max > 0 && count >= Math.max(1, Math.ceil(max * 0.6));
                return `<div class="report-hour-cell ${hot ? 'hot' : ''}">
                    <div class="report-hour-label">${String(hour).padStart(2, '0')}:00</div>
                    <div class="report-hour-value">${count}</div>
                    <div class="report-card-subtitle">次</div>
                </div>`;
            }).join('')}</div>`;
    },

    renderReportTrend() {
        const container = document.getElementById('reportDailyTrendChart');
        if (!container || !this.reportData) return;
        this.renderReportLineChart(container, '每日趋势', this.reportData.dailyTrend || []);
    },

    changeReportMonth(delta) {
        let m = this.currentReportPeriod.month + delta, y = this.currentReportPeriod.year;
        if (m > 12) { m = 1; y++; } else if (m < 1) { m = 12; y--; }
        this.currentReportPeriod = { year: y, month: m };
        this.loadReports();
    },

    exportReport(type) { API.exportReport(type, this.currentReportPeriod.year, this.currentReportPeriod.month); },

    // ==================== 退出登录 ====================
    logout() { this.handleLogout(); }
};

// ---- 全局暴露（HTML onclick 需要） ----
window.app = app;
window.handleLogin = () => app.handleLogin();
window.handleRegister = () => app.handleRegister();
window.showRegisterForm = () => app.showRegisterForm();
window.showLoginForm = () => app.showLoginForm();

// ---- 添加CSS动画 ----
const style = document.createElement('style');
style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@keyframes fadeOut { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-10px); } }`;
document.head.appendChild(style);

// ---- 启动 ----
document.addEventListener('DOMContentLoaded', () => app.init());
