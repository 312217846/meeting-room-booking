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
    getUsers: () => API.request('/api/admin/users'),
    updateUserRole: (id, role) => API.request(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    updateUser: (id, data) => API.request(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id) => API.request(`/api/admin/users/${id}`, { method: 'DELETE' }),
    toggleUserActive: (id) => API.request(`/api/admin/users/${id}/toggle-active`, { method: 'PUT' }),
    resetPassword: (id, newPassword) => API.request(`/api/admin/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
    getStats: () => API.request('/api/admin/stats'),
    getLogs: () => API.request('/api/admin/logs'),
    getReports: (params) => API.request(`/api/admin/reports?${new URLSearchParams(params).toString()}`),
    exportReport: (type, year, month) => { window.open(API.baseUrl + `/api/admin/reports/export?${new URLSearchParams({ type, year, month }).toString()}`); },
    getWxAuthUrl: (redirectUri) => API.request(`/api/auth/wx-url?redirect_uri=${encodeURIComponent(redirectUri)}`),
    wxCallback: (code) => API.request(`/api/auth/wx-callback?code=${code}`)
};

// ---- 全局会议室数据 ----
let ROOMS_DATA = [];

const BOOKING_PURPOSES = ['见客', '招募', '培训', '讲座', '会议', '其他'];

// ---- 应用主对象（唯一入口） ----
const app = {
    currentUser: null,
    currentTab: 'rooms',
    roomFilter: 'all',
    selectedRoom: null,
    selectedDate: null,
    selectedTimeSlots: [],
    bookings: [],
    currentWeekStart: null,
    weekBookings: [],
    currentReportPeriod: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
    reportData: null,
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

    getEndTime(startTime) {
        const [hour, min] = startTime.split(':').map(Number);
        let endHour = hour, endMin = min + 30;
        if (endMin >= 60) { endHour++; endMin = 0; }
        return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
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

    async handleLogin() {
        const phone = document.getElementById('loginPhone').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!phone || !password) { this.showToast('请输入手机号和密码', 'error'); return; }
        const btn = event?.target?.closest('button');
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
        try {
            const res = await API.getRooms();
            if (res.code === 0) {
                ROOMS_DATA = res.data.map(room => ({
                    ...room,
                    type: room.is_vip ? 'vip' : 'normal',
                    equipment: typeof room.equipment === 'string' ? JSON.parse(room.equipment || '[]') : (room.equipment || [])
                }));
            }
        } catch (error) { console.error('加载会议室数据失败:', error); }
    },

    async loadData() {
        try {
            const res = await API.getMe();
            if (res.code === 0) this.currentUser = res.data;
        } catch (e) {
            const saved = localStorage.getItem('currentUser');
            if (saved) this.currentUser = JSON.parse(saved);
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
        else if (tab === 'booking') { this.renderRoomSelect(); this.renderTimeSlots(); this.updateSubmitButtonState(); }
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

        const isNormal = this.currentUser.role === 'normal';
        const todayStr = this.formatDate(new Date());
        const nowHour = new Date().getHours();
        const nowMin = new Date().getMinutes();
        const nowMinutes = nowHour * 60 + nowMin;

        let todayBookings = [];
        try {
            const res = await API.getTodayBookings(todayStr);
            if (res.code === 0) todayBookings = res.data;
        } catch (e) {}

        ROOMS_DATA.forEach(room => {
            const isVip = room.is_vip || room.type === 'vip';
            const isLocked = isVip && isNormal;
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
                const [sh, sm] = (b.start_time || b.startTime || '08:00').split(':').map(Number);
                const [eh, em] = (b.end_time || b.endTime || '09:00').split(':').map(Number);
                const sMin = Math.max(sh * 60 + sm, dayStart);
                const eMin = Math.min(eh * 60 + em, dayEnd);
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
                const [sh, sm] = (b.start_time || b.startTime || '08:00').split(':').map(Number);
                const [eh, em] = (b.end_time || b.endTime || '09:00').split(':').map(Number);
                return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
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
                        ${isVip ? '<span class="room-vip-badge">VIP</span>' : ''}
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
        if ((room.is_vip || room.type === 'vip') && this.currentUser.role === 'normal') {
            this.showVipSheet();
        } else {
            this.selectedRoom = room;
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
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 30);
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
                const isPast = date < today;
                const isOverMax = date > maxDate;
                const isDisabled = isPast || isOverMax;
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
            const isVip = this.selectedRoom.is_vip || this.selectedRoom.type === 'vip';
            const eqHtml = this.selectedRoom.equipment.map(e => `<span>${e}</span>`).join('');
            container.innerHTML = `
                <div class="room-selected-card ${isVip ? 'vip' : ''}">
                    <div class="room-selected-header">
                        <span class="room-selected-name">${this.selectedRoom.name}</span>
                        ${isVip ? '<span class="room-selected-badge">VIP</span>' : ''}
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
        const isNormal = this.currentUser.role === 'normal';
        ROOMS_DATA.forEach(room => {
            const isVip = room.type === 'vip';
            const isLocked = isVip && isNormal;
            const isSelected = this.selectedRoom?.id === room.id;
            const item = document.createElement('div');
            item.className = `room-select-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`;
            item.innerHTML = `<div class="room-select-info"><div class="room-select-name">${room.name} ${isVip ? '<span style="color:var(--vip-gold)">VIP</span>' : ''}</div><div class="room-select-meta">${room.location || room.floor || ''} · ${room.capacity}人</div></div>${isLocked ? '<span style="color:var(--text-secondary)">🔒</span>' : ''}`;
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
        try {
            const res = await API.getBookings({ room_id: this.selectedRoom.id, date: this.selectedDate });
            if (res.code === 0) existingBookings = res.data.map(b => ({ roomId: b.room_id, date: b.booking_date, startTime: b.start_time, endTime: b.end_time, userName: b.user_name, status: b.status }));
        } catch (e) { console.error('获取预订数据失败:', e); }

        const now = new Date();
        const todayStr = this.formatDate(now);
        const isToday = this.selectedDate === todayStr;

        for (let hour = 8; hour < 18; hour++) {
            for (let min = 0; min < 60; min += 30) {
                const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                const slot = document.createElement('div');
                slot.dataset.time = time;

                const isPast = isToday && (hour < now.getHours() || (hour === now.getHours() && min <= now.getMinutes()));
                const booking = existingBookings.find(b => time >= b.startTime && time < b.endTime);

                if (isPast) {
                    slot.className = 'time-slot past';
                    slot.innerHTML = `<span>${time}</span><span class="booker-name">已过</span>`;
                } else if (booking) {
                    slot.className = 'time-slot occupied';
                    slot.innerHTML = `<span>${time}</span><span class="booker-name">${booking.userName}</span>`;
                } else if (this.selectedTimeSlots.includes(time)) {
                    slot.className = 'time-slot selected';
                    slot.textContent = time;
                    slot.onclick = () => this.toggleTimeSlot(time, slot);
                } else {
                    slot.className = 'time-slot available';
                    slot.textContent = time;
                    slot.onclick = () => this.toggleTimeSlot(time, slot);
                }
                container.appendChild(slot);
            }
        }
    },

    toggleTimeSlot(time, element) {
        if (element.classList.contains('occupied')) return;
        const idx = this.selectedTimeSlots.indexOf(time);
        if (idx > -1) {
            this.selectedTimeSlots.splice(idx, 1);
            element.className = 'time-slot available';
        } else {
            this.selectedTimeSlots.push(time);
            this.selectedTimeSlots.sort();
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
        if (this.selectedRoom.type === 'vip' && this.currentUser.role === 'normal') { this.showError('权限不足', '普通员工无法预订VIP会议室'); return; }

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
        try { const res = await API.getAllRooms(); if (res.code === 0) rooms = res.data; } catch (e) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px">加载失败</td></tr>';
            return;
        }
        tbody.innerHTML = rooms.map(room => {
            const eq = typeof room.equipment === 'string' ? JSON.parse(room.equipment || '[]') : (room.equipment || []);
            const eqStr = eq.slice(0, 3).join(', ') + (eq.length > 3 ? '...' : '');
            return `<tr class="room-table-row">
                <td><strong>${room.name}</strong></td><td>${room.capacity}人</td><td>${room.floor || '-'}</td><td>${room.location || '-'}</td><td>${eqStr}</td>
                <td>${room.is_vip ? '<span class="vip-badge-small">VIP</span>' : '-'}</td>
                <td><span class="status-badge ${room.is_active ? 'active' : 'inactive'}">${room.is_active ? '启用' : '停用'}</span></td>
                <td class="room-table-actions"><button class="btn-edit" onclick="app.editRoom(${room.id})">编辑</button><button class="btn-delete" onclick="app.confirmDeleteRoom(${room.id})">删除</button></td></tr>`;
        }).join('');
    },

    async renderAdminUserTable() {
        const tbody = document.getElementById('adminUserTableBody');
        if (!tbody) return;
        let users = [];
        try { const res = await API.getUsers(); if (res.code === 0) users = res.data; } catch (e) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px">加载失败</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(user => `<tr>
            <td><div class="user-table-avatar">${user.avatar || user.name.charAt(0)}</div></td>
            <td><strong>${user.name}</strong></td><td>${user.phone || '-'}</td>
            <td><select class="role-select" onchange="app.changeUserRole(${user.id}, this.value)">
                <option value="normal" ${user.role === 'normal' ? 'selected' : ''}>普通员工</option>
                <option value="premium" ${user.role === 'premium' ? 'selected' : ''}>高级员工</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option></select></td>
            <td><span class="status-badge ${user.is_active !== false ? 'active' : 'inactive'}">${user.is_active !== false ? '正常' : '禁用'}</span></td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
            <td>${(user.role !== 'admin' || user.id !== this.currentUser?.id) ? `<button class="btn-delete" onclick="app.confirmDeleteUser(${user.id})">删除</button>` : '-'}</td></tr>`).join('');
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
            document.getElementById('roomEditIsVip').checked = room ? (room.is_vip || false) : false;
            document.getElementById('roomEditIsActive').checked = room ? (room.is_active !== false) : true;
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
        const data = {
            name: document.getElementById('roomEditName').value,
            capacity: parseInt(document.getElementById('roomEditCapacity').value),
            floor: document.getElementById('roomEditFloor').value,
            location: document.getElementById('roomEditLocation').value,
            equipment: document.getElementById('roomEditEquipment').value.split(',').map(s => s.trim()).filter(s => s),
            description: document.getElementById('roomEditDescription').value,
            is_vip: document.getElementById('roomEditIsVip').checked,
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

    async confirmDeleteUser(userId) {
        if (!confirm('确定要删除这个用户吗？此操作不可撤销。')) return;
        try { const res = await API.deleteUser(userId); if (res.code === 0) { this.showToast('删除成功', 'success'); this.renderAdminUserTable(); } else this.showError('删除失败', res.message); } catch (e) { this.showError('删除失败', '网络错误'); }
    },

    // ==================== 报告 ====================
    async loadReports() {
        try {
            const res = await API.getReports({ year: this.currentReportPeriod.year, month: this.currentReportPeriod.month });
            if (res.code === 0) { this.reportData = res.data; this.renderReports(); }
        } catch (e) { console.error('加载报告失败:', e); }
    },

    renderReports() {
        if (!this.reportData) return;
        document.getElementById('reportPeriod').textContent = `${this.currentReportPeriod.year}年${this.currentReportPeriod.month}月`;
        // 会议室使用排行
        const roomContainer = document.getElementById('roomUsageChart');
        const rooms = (this.reportData.roomUsage || []).filter(r => r.booking_count > 0);
        if (rooms.length === 0) { roomContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">暂无数据</div>'; }
        else { const max = Math.max(...rooms.map(r => r.booking_count)); roomContainer.innerHTML = `<div class="chart-container">${rooms.slice(0, 10).map((r, i) => `<div class="chart-row"><div class="chart-label">${i + 1}. ${r.name}</div><div class="chart-bar-wrapper"><div class="chart-bar" style="width:${r.booking_count / max * 100}%"></div><span class="chart-value">${r.booking_count}次</span></div></div>`).join('')}</div>`; }
        // 用户使用排行
        const userContainer = document.getElementById('userUsageChart');
        const users = (this.reportData.userUsage || []).filter(u => u.booking_count > 0);
        if (users.length === 0) { userContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">暂无数据</div>'; }
        else { const max = Math.max(...users.map(u => u.booking_count)); userContainer.innerHTML = `<div class="chart-container">${users.slice(0, 10).map((u, i) => `<div class="chart-row"><div class="chart-label">${i + 1}. ${u.name}</div><div class="chart-bar-wrapper"><div class="chart-bar" style="width:${u.booking_count / max * 100}%;background:linear-gradient(90deg,#4A90D9,#357ABD)"></div><span class="chart-value">${u.booking_count}次</span></div></div>`).join('')}</div>`; }
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
