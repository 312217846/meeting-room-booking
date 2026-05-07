const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// 数据库配置
const DB_CONFIG = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '4f7a9b2e3c1d4e6f',
    database: 'meeting_room_booking',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 全局连接池
let pool;

// 数据库初始化
async function initDatabase() {
    console.log('🔄 正在初始化数据库...');
    
    try {
        // 1. 先连接 MySQL（不指定数据库）来创建数据库
        const rootPool = mysql.createPool({
            host: DB_CONFIG.host,
            port: DB_CONFIG.port,
            user: DB_CONFIG.user,
            password: DB_CONFIG.password,
            waitForConnections: true,
            connectionLimit: 2
        });
        
        // 创建数据库（如果不存在）
        await rootPool.execute(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('✅ 数据库已创建或已存在');
        
        await rootPool.end();
        
        // 2. 创建连接池（指定数据库）
        pool = mysql.createPool(DB_CONFIG);
        
        // 3. 创建表
        await createTables();
        
        // 4. 初始化默认数据
        await initDefaultData();
        
        console.log('✅ 数据库初始化完成');
        return true;
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        return false;
    }
}

// 创建表
async function createTables() {
    const createTableQueries = [
        // 用户表
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userid VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            avatar VARCHAR(10) DEFAULT NULL,
            phone VARCHAR(20) UNIQUE DEFAULT NULL,
            password_hash VARCHAR(255) DEFAULT NULL,
            gender ENUM('male', 'female') DEFAULT NULL,
            department VARCHAR(100) DEFAULT NULL,
            role ENUM('normal', 'premium', 'admin') DEFAULT 'normal',
            is_active BOOLEAN DEFAULT TRUE,
            wechat_openid VARCHAR(100) DEFAULT NULL,
            wechat_unionid VARCHAR(100) DEFAULT NULL,
            wechat_avatar VARCHAR(500) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME DEFAULT NULL,
            INDEX idx_phone (phone),
            INDEX idx_wechat (wechat_openid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // 会议室表
        `CREATE TABLE IF NOT EXISTS meeting_rooms (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            capacity INT NOT NULL DEFAULT 10,
            floor VARCHAR(50) DEFAULT NULL,
            location VARCHAR(200) DEFAULT NULL,
            equipment JSON DEFAULT NULL,
            images JSON DEFAULT NULL,
            description TEXT DEFAULT NULL,
            is_vip BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INT DEFAULT 0,
            created_by VARCHAR(50) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_active (is_active),
            INDEX idx_sort (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // 预订表
        `CREATE TABLE IF NOT EXISTS bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            booking_no VARCHAR(50) UNIQUE NOT NULL,
            room_id INT NOT NULL,
            user_id VARCHAR(50) NOT NULL,
            booking_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            title VARCHAR(200) NOT NULL,
            attendees JSON DEFAULT NULL,
            attendee_count INT DEFAULT 0,
            remark TEXT DEFAULT NULL,
            status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            cancelled_at DATETIME DEFAULT NULL,
            cancelled_by VARCHAR(50) DEFAULT NULL,
            INDEX idx_room_date (room_id, booking_date),
            INDEX idx_user (user_id),
            INDEX idx_status (status),
            FOREIGN KEY (room_id) REFERENCES meeting_rooms(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // 操作日志表
        `CREATE TABLE IF NOT EXISTS operation_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            action VARCHAR(50) NOT NULL,
            target_type VARCHAR(50) NOT NULL,
            target_id INT DEFAULT NULL,
            old_value JSON DEFAULT NULL,
            new_value JSON DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_target (target_type, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // 系统配置表
        `CREATE TABLE IF NOT EXISTS system_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(100) UNIQUE NOT NULL,
            config_value TEXT DEFAULT NULL,
            description VARCHAR(255) DEFAULT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];
    
    for (const query of createTableQueries) {
        await pool.execute(query);
    }
    console.log('✅ 数据表已创建或已存在');
}

// 初始化默认数据
async function initDefaultData() {
    // 检查是否需要插入默认会议室
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM meeting_rooms');
    
    if (rows[0].count === 0) {
        const defaultRooms = [
            { name: '木星会议室', capacity: 20, floor: '3F', location: '3楼东侧', equipment: ['投影仪', '白板', '音响'], is_vip: false },
            { name: '火星会议室', capacity: 12, floor: '3F', location: '3楼西侧', equipment: ['投影仪', '白板', '电视'], is_vip: false },
            { name: '水星会议室', capacity: 6, floor: '2F', location: '2楼西侧', equipment: ['电视', '白板'], is_vip: false },
            { name: '金星VIP会议室', capacity: 20, floor: '1F', location: '1楼东侧', equipment: ['4K投影', '视频会议', '电子白板'], is_vip: true },
            { name: '土星VIP会议室', capacity: 40, floor: '1F', location: '1楼大厅', equipment: ['舞台', '音响', '麦克风', '4K投影'], is_vip: true }
        ];
        
        for (const room of defaultRooms) {
            await pool.execute(
                `INSERT INTO meeting_rooms (name, capacity, floor, location, equipment, is_vip, sort_order) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [room.name, room.capacity, room.floor, room.location, JSON.stringify(room.equipment), room.is_vip, 0]
            );
        }
        console.log('✅ 已插入 5 条默认会议室数据');
    } else {
        console.log(`✅ 会议室数据已存在 (${rows[0].count} 条)`);
    }
}

// 中间件
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'meeting-room-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
    }
}));

// 登录验证中间件
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ code: 401, message: '请先登录' });
    }
}

// 管理员验证中间件
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ code: 403, message: '需要管理员权限' });
    }
}

// 生成用户ID
function generateUserId() {
    return 'USER' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

// 生成首字母头像
function generateAvatar(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

// ========== 认证接口 ==========

// 检查是否为第一个用户
async function isFirstUser() {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    return rows[0].count === 0;
}

// 注册接口
app.post('/api/auth/register', async (req, res) => {
    const { phone, password, name, gender } = req.body;
    
    if (!phone || !password || !name) {
        return res.status(400).json({ code: 400, message: '手机号、密码和姓名不能为空' });
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ code: 400, message: '手机号格式不正确' });
    }
    
    // 验证密码长度
    if (password.length < 6) {
        return res.status(400).json({ code: 400, message: '密码长度至少6位' });
    }
    
    try {
        // 检查手机号是否已注册
        const [existingUsers] = await pool.execute(
            'SELECT * FROM users WHERE phone = ?',
            [phone]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ code: 400, message: '该手机号已注册' });
        }
        
        // 检查是否为第一个用户
        const firstUser = await isFirstUser();
        const role = firstUser ? 'admin' : 'normal';
        
        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10);
        const userid = generateUserId();
        const avatar = generateAvatar(name);
        
        // 创建用户
        const [result] = await pool.execute(
            `INSERT INTO users (userid, name, avatar, phone, password_hash, gender, role, created_at, last_login_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [userid, name, avatar, phone, passwordHash, gender || null, role]
        );
        
        const user = {
            id: result.insertId,
            userid: userid,
            name: name,
            avatar: avatar,
            phone: phone,
            role: role,
            gender: gender || null
        };
        
        // 设置session
        req.session.user = user;
        
        res.json({ 
            code: 0, 
            data: { 
                user,
                isFirstUser: firstUser
            }, 
            message: firstUser ? '注册成功，您已成为系统管理员' : '注册成功' 
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ code: 500, message: '注册失败: ' + error.message });
    }
});

// 登录接口
app.post('/api/auth/login', async (req, res) => {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
        return res.status(400).json({ code: 400, message: '手机号和密码不能为空' });
    }
    
    try {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE phone = ?',
            [phone]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ code: 401, message: '手机号或密码错误' });
        }
        
        const user = users[0];
        
        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ code: 401, message: '手机号或密码错误' });
        }
        
        // 更新登录时间
        await pool.execute(
            'UPDATE users SET last_login_at = NOW() WHERE id = ?',
            [user.id]
        );
        
        const userInfo = {
            id: user.id,
            userid: user.userid,
            name: user.name,
            avatar: user.avatar || generateAvatar(user.name),
            phone: user.phone,
            role: user.role,
            gender: user.gender,
            wechat_avatar: user.wechat_avatar
        };
        
        // 设置session
        req.session.user = userInfo;
        
        res.json({ code: 0, data: { user: userInfo }, message: '登录成功' });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ code: 500, message: '登录失败: ' + error.message });
    }
});

// 微信登录 - 获取授权URL
app.get('/api/auth/wx-url', async (req, res) => {
    const { redirect_uri, state = '' } = req.query;
    const appid = process.env.WX_APPID;
    
    if (!appid) {
        return res.status(500).json({ code: 500, message: '微信登录未配置' });
    }
    
    const scope = 'snsapi_userinfo'; // 公众号网页授权
    const encodedRedirect = encodeURIComponent(redirect_uri || `${process.env.FRONTEND_URL || 'https://AIAmeeting.pmagic.cn'}/api/auth/wx-callback`);
    
    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
    
    res.json({ code: 0, data: { authUrl } });
});

// 微信登录回调
app.get('/api/auth/wx-callback', async (req, res) => {
    console.log('[WX-CALLBACK] query:', JSON.stringify(req.query));
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).json({ code: 400, message: '缺少授权码' });
    }
    
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_APP_SECRET;
    
    if (!appid || !secret) {
        return res.status(500).json({ code: 500, message: '微信登录未配置' });
    }
    
    try {
        // 1. 获取access_token和openid
        const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`);
        const tokenData = await tokenRes.json();
        
        if (tokenData.errcode) {
            return res.status(400).json({ code: 400, message: tokenData.errmsg || '微信授权失败' });
        }
        
        const { access_token, openid, unionid } = tokenData;
        
        // 2. 获取用户信息
        const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`);
        const userInfo = await userRes.json();
        
        if (userInfo.errcode) {
            return res.status(400).json({ code: 400, message: userInfo.errmsg || '获取用户信息失败' });
        }
        
        const { nickname, headimgurl, sex } = userInfo;
        
        // 3. 检查用户是否已存在
        const [existingUsers] = await pool.execute(
            'SELECT * FROM users WHERE wechat_openid = ?',
            [openid]
        );
        
        let user;
        
        if (existingUsers.length > 0) {
            // 已存在，更新登录时间
            user = existingUsers[0];
            await pool.execute(
                'UPDATE users SET last_login_at = NOW(), wechat_avatar = ? WHERE id = ?',
                [headimgurl, user.id]
            );
        } else {
            // 新用户，自动注册
            const userid = generateUserId();
            const firstUser = await isFirstUser();
            const role = firstUser ? 'admin' : 'normal';
            
            const [result] = await pool.execute(
                `INSERT INTO users (userid, name, avatar, wechat_openid, wechat_unionid, wechat_avatar, gender, role, created_at, last_login_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [userid, nickname, nickname.charAt(0).toUpperCase(), openid, unionid || null, headimgurl, sex === 1 ? 'male' : sex === 2 ? 'female' : null, role]
            );
            
            user = {
                id: result.insertId,
                userid: userid,
                name: nickname,
                avatar: nickname.charAt(0).toUpperCase(),
                wechat_openid: openid,
                wechat_unionid: unionid,
                wechat_avatar: headimgurl,
                gender: sex === 1 ? 'male' : sex === 2 ? 'female' : null,
                role: role
            };
        }
        
        const userData = {
            id: user.id,
            userid: user.userid,
            name: user.name,
            avatar: user.avatar,
            phone: user.phone || null,
            role: user.role,
            gender: user.gender,
            wechat_avatar: headimgurl || user.wechat_avatar
        };
        
        // 设置session
        req.session.user = userData;
        
        // 返回JSON
        res.json({
            code: 0,
            data: { user: userData, isNewUser: existingUsers.length === 0 },
            message: existingUsers.length > 0 ? '登录成功' : '注册成功'
        });
        
    } catch (error) {
        console.error('微信登录失败:', error);
        res.status(500).json({ code: 500, message: '微信登录失败: ' + error.message });
    }
});

// 绑定微信（预留接口）
app.post('/api/auth/bind-wechat', requireAuth, async (req, res) => {
    const { code } = req.body;
    
    // 预留接口
    res.status(501).json({ code: 501, message: '微信绑定功能开发中' });
});

// 获取当前用户信息
app.get('/api/user/me', requireAuth, (req, res) => {
    res.json({ code: 0, data: req.session.user });
});

// 退出登录
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ code: 0, message: '退出成功' });
});

// ========== 会议室管理接口 ==========

// 获取会议室列表
app.get('/api/rooms', requireAuth, async (req, res) => {
    try {
        const [rooms] = await pool.execute(
            'SELECT * FROM meeting_rooms WHERE is_active = TRUE ORDER BY sort_order, id'
        );
        res.json({ code: 0, data: rooms });
    } catch (error) {
        console.error('获取会议室失败:', error);
        res.status(500).json({ code: 500, message: '获取会议室失败' });
    }
});

// 获取会议室详情
app.get('/api/rooms/all', requireAdmin, async (req, res) => {
    try {
        const [rooms] = await pool.execute(
            'SELECT * FROM meeting_rooms ORDER BY sort_order, id'
        );
        res.json({ code: 0, data: rooms });
    } catch (error) {
        console.error('获取会议室失败:', error);
        res.status(500).json({ code: 500, message: '获取会议室失败' });
    }
});

app.get('/api/rooms/:id', requireAuth, async (req, res) => {
    try {
        const [rooms] = await pool.execute(
            'SELECT * FROM meeting_rooms WHERE id = ?',
            [req.params.id]
        );
        if (rooms.length === 0) {
            return res.status(404).json({ code: 404, message: '会议室不存在' });
        }
        res.json({ code: 0, data: rooms[0] });
    } catch (error) {
        console.error('获取会议室详情失败:', error);
        res.status(500).json({ code: 500, message: '获取会议室详情失败' });
    }
});

// 创建会议室（管理员）
app.post('/api/rooms', requireAdmin, async (req, res) => {
    const { name, capacity, floor, location, equipment, images, description, is_vip, sort_order } = req.body;
    
    try {
        const [result] = await pool.execute(
            `INSERT INTO meeting_rooms (name, capacity, floor, location, equipment, images, description, is_vip, sort_order, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, capacity, floor, location, JSON.stringify(equipment || []), JSON.stringify(images || []), description, is_vip || false, sort_order || 0, req.session.user.userid]
        );
        
        // 记录操作日志
        await pool.execute(
            `INSERT INTO operation_logs (user_id, action, target_type, target_id, new_value) VALUES (?, 'create', 'room', ?, ?)`,
            [req.session.user.userid, result.insertId, JSON.stringify(req.body)]
        );
        
        res.json({ code: 0, data: { id: result.insertId }, message: '创建成功' });
    } catch (error) {
        console.error('创建会议室失败:', error);
        res.status(500).json({ code: 500, message: '创建会议室失败' });
    }
});

// 更新会议室（管理员）
app.put('/api/rooms/:id', requireAdmin, async (req, res) => {
    const { name, capacity, floor, location, equipment, images, description, is_vip, is_active, sort_order } = req.body;
    const roomId = req.params.id;
    
    try {
        // 获取旧值
        const [oldRooms] = await pool.execute('SELECT * FROM meeting_rooms WHERE id = ?', [roomId]);
        if (oldRooms.length === 0) {
            return res.status(404).json({ code: 404, message: '会议室不存在' });
        }
        
        await pool.execute(
            `UPDATE meeting_rooms SET 
                name = ?, capacity = ?, floor = ?, location = ?, 
                equipment = ?, images = ?, description = ?, 
                is_vip = ?, is_active = ?, sort_order = ?
             WHERE id = ?`,
            [name, capacity, floor, location, JSON.stringify(equipment || []), JSON.stringify(images || []), description, is_vip, is_active, sort_order, roomId]
        );
        
        // 记录操作日志
        await pool.execute(
            `INSERT INTO operation_logs (user_id, action, target_type, target_id, old_value, new_value) VALUES (?, 'update', 'room', ?, ?, ?)`,
            [req.session.user.userid, roomId, JSON.stringify(oldRooms[0]), JSON.stringify(req.body)]
        );
        
        res.json({ code: 0, message: '更新成功' });
    } catch (error) {
        console.error('更新会议室失败:', error);
        res.status(500).json({ code: 500, message: '更新会议室失败' });
    }
});

// 删除会议室（管理员）
app.delete('/api/rooms/:id', requireAdmin, async (req, res) => {
    const roomId = req.params.id;
    
    try {
        // 检查是否有未完成的预订
        const [bookings] = await pool.execute(
            'SELECT COUNT(*) as count FROM bookings WHERE room_id = ? AND status = "confirmed" AND booking_date >= CURDATE()',
            [roomId]
        );
        
        if (bookings[0].count > 0) {
            return res.status(400).json({ code: 400, message: '该会议室有未来预订，无法删除' });
        }
        
        // 软删除
        await pool.execute('UPDATE meeting_rooms SET is_active = FALSE WHERE id = ?', [roomId]);
        
        // 记录操作日志
        await pool.execute(
            `INSERT INTO operation_logs (user_id, action, target_type, target_id) VALUES (?, 'delete', 'room', ?)`,
            [req.session.user.userid, roomId]
        );
        
        res.json({ code: 0, message: '删除成功' });
    } catch (error) {
        console.error('删除会议室失败:', error);
        res.status(500).json({ code: 500, message: '删除会议室失败' });
    }
});

// ========== 预订管理接口 ==========

// 生成预订编号
function generateBookingNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BK${dateStr}${random}`;
}

// 获取预订列表
app.get('/api/bookings', requireAuth, async (req, res) => {
    const { room_id, date, user_id, status } = req.query;
    
    try {
        let sql = `
            SELECT b.*, r.name as room_name, r.capacity as room_capacity, u.name as user_name 
            FROM bookings b 
            JOIN meeting_rooms r ON b.room_id = r.id 
            JOIN users u ON b.user_id = u.userid 
            WHERE 1=1
        `;
        const params = [];
        
        if (room_id) {
            sql += ' AND b.room_id = ?';
            params.push(room_id);
        }
        if (date) {
            sql += ' AND b.booking_date = ?';
            params.push(date);
        }
        if (user_id) {
            sql += ' AND b.user_id = ?';
            params.push(user_id);
        }
        if (status) {
            sql += ' AND b.status = ?';
            params.push(status);
        }
        
        // 非管理员只能看自己的
        if (req.session.user.role !== 'admin') {
            sql += ' AND b.user_id = ?';
            params.push(req.session.user.userid);
        }
        
        sql += ' ORDER BY b.booking_date DESC, b.start_time DESC';
        
        const [bookings] = await pool.execute(sql, params);
        res.json({ code: 0, data: bookings });
    } catch (error) {
        console.error('获取预订列表失败:', error);
        res.status(500).json({ code: 500, message: '获取预订列表失败' });
    }
});

// 检查时间段是否可用
app.get('/api/bookings/check-availability', requireAuth, async (req, res) => {
    const { room_id, date, start_time, end_time, exclude_id } = req.query;
    
    try {
        let sql = `
            SELECT COUNT(*) as count FROM bookings 
            WHERE room_id = ? AND booking_date = ? AND status = 'confirmed'
            AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND end_time <= ?))
        `;
        const params = [room_id, date, end_time, start_time, end_time, start_time, start_time, end_time];
        
        if (exclude_id) {
            sql += ' AND id != ?';
            params.push(exclude_id);
        }
        
        const [result] = await pool.execute(sql, params);
        
        res.json({ 
            code: 0, 
            data: { 
                available: result[0].count === 0,
                conflict: result[0].count > 0
            } 
        });
    } catch (error) {
        console.error('检查可用性失败:', error);
        res.status(500).json({ code: 500, message: '检查可用性失败' });
    }
});

// 创建预订
app.post('/api/bookings', requireAuth, async (req, res) => {
    const { room_id, booking_date, start_time, end_time, title, attendees, attendee_count, remark } = req.body;
    
    try {
        // 检查会议室是否存在
        const [rooms] = await pool.execute('SELECT * FROM meeting_rooms WHERE id = ? AND is_active = TRUE', [room_id]);
        if (rooms.length === 0) {
            return res.status(404).json({ code: 404, message: '会议室不存在' });
        }
        
        const room = rooms[0];
        
        // 检查VIP权限
        if (room.is_vip && req.session.user.role === 'normal') {
            return res.status(403).json({ code: 403, message: 'VIP会议室需要升级权限' });
        }
        
        // 检查时间段是否冲突
        const [conflicts] = await pool.execute(
            `SELECT COUNT(*) as count FROM bookings 
             WHERE room_id = ? AND booking_date = ? AND status = 'confirmed'
             AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND end_time <= ?))`,
            [room_id, booking_date, end_time, start_time, end_time, start_time, start_time, end_time]
        );
        
        if (conflicts[0].count > 0) {
            return res.status(400).json({ code: 400, message: '该时间段已被预订' });
        }
        
        // 检查容量
        if (attendee_count > room.capacity) {
            return res.status(400).json({ code: 400, message: `超出会议室容量限制（最大${room.capacity}人）` });
        }
        
        const bookingNo = generateBookingNo();
        
        const [result] = await pool.execute(
            `INSERT INTO bookings (booking_no, room_id, user_id, booking_date, start_time, end_time, title, attendees, attendee_count, remark) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bookingNo, room_id, req.session.user.userid, booking_date, start_time, end_time, title, JSON.stringify(attendees || []), attendee_count || 0, remark || null]
        );
        
        res.json({ code: 0, data: { id: result.insertId, booking_no: bookingNo }, message: '预订成功' });
    } catch (error) {
        console.error('创建预订失败:', error);
        res.status(500).json({ code: 500, message: '创建预订失败' });
    }
});

// 取消预订
app.put('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
    const bookingId = req.params.id;
    
    try {
        // 检查预订是否存在
        const [bookings] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        if (bookings.length === 0) {
            return res.status(404).json({ code: 404, message: '预订不存在' });
        }
        
        const booking = bookings[0];
        
        // 检查权限（只能取消自己的，管理员可以取消所有人的）
        if (booking.user_id !== req.session.user.userid && req.session.user.role !== 'admin') {
            return res.status(403).json({ code: 403, message: '无权取消此预订' });
        }
        
        // 检查是否已经取消
        if (booking.status === 'cancelled') {
            return res.status(400).json({ code: 400, message: '预订已取消' });
        }
        
        await pool.execute(
            'UPDATE bookings SET status = "cancelled", cancelled_at = NOW(), cancelled_by = ? WHERE id = ?',
            [req.session.user.userid, bookingId]
        );
        
        res.json({ code: 0, message: '取消成功' });
    } catch (error) {
        console.error('取消预订失败:', error);
        res.status(500).json({ code: 500, message: '取消预订失败' });
    }
});

// ========== 管理员接口 ==========

// 获取用户列表（管理员）
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, userid, name, avatar, department, role, phone, email, gender, created_at, last_login_at FROM users ORDER BY created_at DESC'
        );
        res.json({ code: 0, data: users });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({ code: 500, message: '获取用户列表失败' });
    }
});

// 更新用户角色（管理员）
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;
    
    try {
        await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        res.json({ code: 0, message: '更新成功' });
    } catch (error) {
        console.error('更新用户角色失败:', error);
        res.status(500).json({ code: 500, message: '更新用户角色失败' });
    }
});

// 更新用户信息（管理员）
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const { name, phone, role, gender } = req.body;
    const userId = req.params.id;
    
    try {
        await pool.execute(
            'UPDATE users SET name = ?, phone = ?, role = ?, gender = ? WHERE id = ?',
            [name, phone, role, gender, userId]
        );
        res.json({ code: 0, message: '更新成功' });
    } catch (error) {
        console.error('更新用户信息失败:', error);
        res.status(500).json({ code: 500, message: '更新用户信息失败' });
    }
});

// 删除用户（管理员）
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    
    try {
        // 不能删除自己
        if (parseInt(userId) === req.session.user.id) {
            return res.status(400).json({ code: 400, message: '不能删除当前登录用户' });
        }
        
        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ code: 0, message: '删除成功' });
    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({ code: 500, message: '删除用户失败' });
    }
});

// 禁用/启用用户（管理员）
app.put('/api/admin/users/:id/toggle-active', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    
    try {
        // 不能禁用自己
        if (parseInt(userId) === req.session.user.id) {
            return res.status(400).json({ code: 400, message: '不能禁用当前登录用户' });
        }
        
        // 获取当前状态
        const [users] = await pool.execute('SELECT is_active FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ code: 404, message: '用户不存在' });
        }
        
        const newStatus = !users[0].is_active;
        await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
        
        res.json({ code: 0, data: { is_active: newStatus }, message: newStatus ? '已启用' : '已禁用' });
    } catch (error) {
        console.error('切换用户状态失败:', error);
        res.status(500).json({ code: 500, message: '操作失败' });
    }
});

// 重置用户密码（管理员）
app.put('/api/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ code: 400, message: '密码长度至少6位' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
        res.json({ code: 0, message: '密码重置成功' });
    } catch (error) {
        console.error('重置密码失败:', error);
        res.status(500).json({ code: 500, message: '重置密码失败' });
    }
});

// 获取统计数据（管理员）
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [[roomStats]] = await pool.execute('SELECT COUNT(*) as total FROM meeting_rooms WHERE is_active = TRUE');
        const [[bookingStats]] = await pool.execute('SELECT COUNT(*) as total FROM bookings WHERE booking_date = CURDATE() AND status = "confirmed"');
        const [[userStats]] = await pool.execute('SELECT COUNT(*) as total FROM users');
        const [[vipStats]] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE role = "premium"');
        const [[adminStats]] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE role = "admin"');
        
        res.json({
            code: 0,
            data: {
                totalRooms: roomStats.total,
                todayBookings: bookingStats.total,
                totalUsers: userStats.total,
                vipUsers: vipStats.total,
                adminUsers: adminStats.total
            }
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({ code: 500, message: '获取统计数据失败' });
    }
});

// 获取报告数据（管理员）
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
    const { type = 'monthly', year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    
    try {
        // 构建时间范围
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = month === 12 ? `${parseInt(year) + 1}-01-01` : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
        
        // 1. 各会议室使用次数排行
        const [roomUsage] = await pool.execute(`
            SELECT r.id, r.name, r.is_vip, COUNT(b.id) as booking_count,
                   SUM(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time)) as total_minutes
            FROM meeting_rooms r
            LEFT JOIN bookings b ON r.id = b.room_id 
                AND b.status = 'confirmed' 
                AND b.booking_date >= ? AND b.booking_date < ?
            WHERE r.is_active = TRUE
            GROUP BY r.id
            ORDER BY booking_count DESC
        `, [startDate, endDate]);
        
        // 2. 用户使用排行
        const [userUsage] = await pool.execute(`
            SELECT u.id, u.userid, u.name, COUNT(b.id) as booking_count,
                   SUM(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time)) as total_minutes
            FROM users u
            LEFT JOIN bookings b ON u.userid = b.user_id 
                AND b.status = 'confirmed' 
                AND b.booking_date >= ? AND b.booking_date < ?
            GROUP BY u.id
            ORDER BY booking_count DESC
            LIMIT 20
        `, [startDate, endDate]);
        
        // 3. 每日趋势（当前月）
        const [dailyTrend] = await pool.execute(`
            SELECT booking_date, COUNT(*) as booking_count,
                   SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) as total_minutes
            FROM bookings
            WHERE status = 'confirmed' 
                AND booking_date >= ? AND booking_date < ?
            GROUP BY booking_date
            ORDER BY booking_date
        `, [startDate, endDate]);
        
        // 4. 总体统计
        const [[totalStats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total_bookings,
                SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) as total_minutes,
                AVG(TIMESTAMPDIFF(MINUTE, start_time, end_time)) as avg_minutes
            FROM bookings
            WHERE status = 'confirmed' 
                AND booking_date >= ? AND booking_date < ?
        `, [startDate, endDate]);
        
        // 5. 每周趋势
        const [weeklyTrend] = await pool.execute(`
            SELECT 
                YEARWEEK(booking_date, 1) as week,
                MIN(booking_date) as week_start,
                COUNT(*) as booking_count,
                SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) as total_minutes
            FROM bookings
            WHERE status = 'confirmed' 
                AND booking_date >= DATE_SUB(?, INTERVAL 3 MONTH)
                AND booking_date < ?
            GROUP BY YEARWEEK(booking_date, 1)
            ORDER BY week DESC
            LIMIT 12
        `, [endDate, endDate]);
        
        res.json({
            code: 0,
            data: {
                period: { year, month, startDate, endDate },
                roomUsage,
                userUsage,
                dailyTrend,
                weeklyTrend,
                totalStats: {
                    totalBookings: totalStats.total_bookings || 0,
                    totalHours: Math.round((totalStats.total_minutes || 0) / 60 * 10) / 10,
                    avgDuration: Math.round((totalStats.avg_minutes || 0)) || 0
                }
            }
        });
    } catch (error) {
        console.error('获取报告数据失败:', error);
        res.status(500).json({ code: 500, message: '获取报告数据失败: ' + error.message });
    }
});

// 导出报告CSV（管理员）
app.get('/api/admin/reports/export', requireAdmin, async (req, res) => {
    const { type = 'room', year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = month === 12 ? `${parseInt(year) + 1}-01-01` : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
        
        let data, filename, headers;
        
        if (type === 'room') {
            // 会议室使用统计
            const [rows] = await pool.execute(`
                SELECT r.name as '会议室名称', r.capacity as '容量', 
                       COUNT(b.id) as '预订次数',
                       ROUND(SUM(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time))/60, 1) as '使用时长(小时)',
                       CASE r.is_vip WHEN 1 THEN 'VIP' ELSE '普通' END as '类型'
                FROM meeting_rooms r
                LEFT JOIN bookings b ON r.id = b.room_id 
                    AND b.status = 'confirmed' 
                    AND b.booking_date >= ? AND b.booking_date < ?
                WHERE r.is_active = TRUE
                GROUP BY r.id
                ORDER BY COUNT(b.id) DESC
            `, [startDate, endDate]);
            
            data = rows;
            filename = `会议室使用统计_${year}${String(month).padStart(2, '0')}.csv`;
            headers = ['会议室名称', '容量', '预订次数', '使用时长(小时)', '类型'];
            
        } else if (type === 'user') {
            // 用户使用统计
            const [rows] = await pool.execute(`
                SELECT u.name as '用户姓名', u.phone as '手机号',
                       COUNT(b.id) as '预订次数',
                       ROUND(SUM(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time))/60, 1) as '使用时长(小时)'
                FROM users u
                LEFT JOIN bookings b ON u.userid = b.user_id 
                    AND b.status = 'confirmed' 
                    AND b.booking_date >= ? AND b.booking_date < ?
                GROUP BY u.id
                ORDER BY COUNT(b.id) DESC
            `, [startDate, endDate]);
            
            data = rows;
            filename = `用户使用统计_${year}${String(month).padStart(2, '0')}.csv`;
            headers = ['用户姓名', '手机号', '预订次数', '使用时长(小时)'];
            
        } else if (type === 'booking') {
            // 详细预订记录
            const [rows] = await pool.execute(`
                SELECT b.booking_no as '预订编号', r.name as '会议室', u.name as '预订人',
                       b.booking_date as '日期', b.start_time as '开始时间', b.end_time as '结束时间',
                       b.title as '会议主题', b.status as '状态'
                FROM bookings b
                JOIN meeting_rooms r ON b.room_id = r.id
                JOIN users u ON b.user_id = u.userid
                WHERE b.booking_date >= ? AND b.booking_date < ?
                ORDER BY b.booking_date DESC, b.start_time DESC
            `, [startDate, endDate]);
            
            data = rows;
            filename = `预订记录_${year}${String(month).padStart(2, '0')}.csv`;
            headers = ['预订编号', '会议室', '预订人', '日期', '开始时间', '结束时间', '会议主题', '状态'];
        }
        
        // 生成CSV内容
        let csvContent = '\uFEFF'; // BOM for Excel
        csvContent += headers.join(',') + '\n';
        
        data.forEach(row => {
            const values = headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val);
                // 如果包含逗号或引号，需要转义
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            });
            csvContent += values.join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.send(csvContent);
        
    } catch (error) {
        console.error('导出报告失败:', error);
        res.status(500).json({ code: 500, message: '导出报告失败: ' + error.message });
    }
});

// 获取操作日志（管理员）
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    try {
        const [logs] = await pool.execute(
            'SELECT l.*, u.name as user_name FROM operation_logs l LEFT JOIN users u ON l.user_id = u.userid ORDER BY l.created_at DESC LIMIT 100'
        );
        res.json({ code: 0, data: logs });
    } catch (error) {
        console.error('获取操作日志失败:', error);
        res.status(500).json({ code: 500, message: '获取操作日志失败' });
    }
});

// 获取当日所有预订（用于点阵图）
app.get('/api/bookings/today', requireAuth, async (req, res) => {
    const { date } = req.query;
    
    try {
        const queryDate = date || new Date().toISOString().split('T')[0];
        
        const [bookings] = await pool.execute(`
            SELECT b.*, r.name as room_name, u.name as user_name, u.avatar as user_avatar
            FROM bookings b 
            JOIN meeting_rooms r ON b.room_id = r.id 
            JOIN users u ON b.user_id = u.userid 
            WHERE b.booking_date = ? AND b.status = 'confirmed'
            ORDER BY b.start_time
        `, [queryDate]);
        
        res.json({ code: 0, data: bookings });
    } catch (error) {
        console.error('获取当日预订失败:', error);
        res.status(500).json({ code: 500, message: '获取当日预订失败' });
    }
});

// 健康检查
app.get('/api/health', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({ code: 0, status: 'ok', db: 'connected', time: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ code: 500, status: 'error', db: 'disconnected', message: error.message });
    }
});

// 启动服务器
async function startServer() {
    // 先初始化数据库
    const dbInitialized = await initDatabase();
    
    if (!dbInitialized) {
        console.error('数据库初始化失败，服务器无法启动');
        process.exit(1);
    }
    
    app.listen(PORT, () => {
        console.log(`会议室预订系统服务器运行在端口 ${PORT}`);
        console.log(`访问地址: http://localhost:${PORT}`);
    });
}

startServer();

module.exports = app;
