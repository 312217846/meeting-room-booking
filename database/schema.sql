-- 会议室预订系统数据库结构
-- 支持企业微信登录

CREATE DATABASE IF NOT EXISTS meeting_room_booking 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE meeting_room_booking;

-- 用户表（对接企业微信）
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    userid VARCHAR(64) UNIQUE NOT NULL COMMENT '企业微信用户ID',
    name VARCHAR(64) NOT NULL COMMENT '用户姓名',
    password_hash VARCHAR(255) COMMENT '密码哈希',
    gender ENUM('unknown', 'male', 'female') DEFAULT 'unknown' COMMENT '性别',
    avatar VARCHAR(255) COMMENT '头像URL',
    department VARCHAR(255) COMMENT '部门',
    role ENUM('normal', 'premium', 'admin') DEFAULT 'normal' COMMENT '用户角色',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    english_name VARCHAR(100) DEFAULT NULL COMMENT '英文名',
    last_name VARCHAR(100) DEFAULT NULL COMMENT '姓氏',
    region VARCHAR(100) DEFAULT NULL COMMENT '区域',
    group_name VARCHAR(100) DEFAULT NULL COMMENT '组别',
    booking_permissions JSON DEFAULT NULL COMMENT '可预订会议室类型',
    daily_booking_limit_minutes INT DEFAULT 180 COMMENT '每日预订上限（分钟）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    INDEX idx_userid (userid),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 会议室表
CREATE TABLE IF NOT EXISTS meeting_rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '会议室名称',
    capacity INT NOT NULL DEFAULT 10 COMMENT '容纳人数',
    floor VARCHAR(20) COMMENT '楼层',
    location VARCHAR(255) COMMENT '具体位置',
    equipment JSON COMMENT '设备清单 ["投影仪", "白板", "视频会议"]',
    images JSON COMMENT '会议室图片URL数组',
    description TEXT COMMENT '会议室描述',
    is_vip BOOLEAN DEFAULT FALSE COMMENT '是否VIP会议室',
    room_type ENUM('normal', 'training', 'vip') DEFAULT 'normal' COMMENT '会议室类型',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(64) COMMENT '创建人userid',
    INDEX idx_vip (is_vip),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议室表';

-- 预订表
CREATE TABLE IF NOT EXISTS bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_no VARCHAR(32) UNIQUE NOT NULL COMMENT '预订编号 BK+年月日+4位序号',
    room_id INT NOT NULL COMMENT '会议室ID',
    user_id VARCHAR(64) NOT NULL COMMENT '预订人userid',
    booking_date DATE NOT NULL COMMENT '预订日期',
    start_time TIME NOT NULL COMMENT '开始时间',
    end_time TIME NOT NULL COMMENT '结束时间',
    title VARCHAR(200) NOT NULL COMMENT '会议主题',
    attendees TEXT COMMENT '参与人（JSON数组）',
    attendee_count INT DEFAULT 0 COMMENT '参会人数',
    status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed' COMMENT '状态',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL COMMENT '取消时间',
    cancelled_by VARCHAR(64) COMMENT '取消人',
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(id),
    INDEX idx_user (user_id),
    INDEX idx_room_date (room_id, booking_date),
    INDEX idx_date_range (booking_date, start_time, end_time),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预订表';

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(64) NOT NULL COMMENT '操作人',
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    target_type VARCHAR(50) COMMENT '操作对象类型',
    target_id INT COMMENT '操作对象ID',
    old_value JSON COMMENT '旧值',
    new_value JSON COMMENT '新值',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    user_agent TEXT COMMENT '浏览器信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description VARCHAR(255) COMMENT '配置说明',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(64) COMMENT '更新人'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 初始化数据
INSERT INTO system_config (config_key, config_value, description) VALUES
('default_daily_booking_limit_minutes', '180', '默认每日预订上限（分钟）'),
('booking_max_days', '365', '最大可提前预订天数'),
('booking_purposes', '["见客","招募","培训","讲座","会议","其他"]', '预订用途选项'),
('booking_max_duration', '4', '单次最大预订时长（小时）'),
('vip_only_rooms', '[]', '仅VIP可预订的会议室ID列表'),
('work_start_time', '09:00', '工作开始时间'),
('work_end_time', '18:00', '工作结束时间'),
('time_slot_interval', '30', '时间间隔（分钟）')
ON DUPLICATE KEY UPDATE
    config_value = VALUES(config_value),
    description = VALUES(description);

-- 插入示例会议室
INSERT INTO meeting_rooms (name, capacity, floor, location, equipment, description, is_vip, room_type, sort_order) VALUES
('第一会议室', 8, '3F', 'A区301室', '["投影仪", "白板", "音响"]', '标准会议室，适合小型会议', FALSE, 'normal', 1),
('第二会议室', 12, '3F', 'A区302室', '["投影仪", "白板", "音响", "视频会议"]', '中型会议室，配备视频会议设备', FALSE, 'normal', 2),
('培训教室', 30, '4F', 'C区401室', '["投影仪", "白板", "音响", "培训桌椅"]', '培训会议室，适合课程和讲座', FALSE, 'training', 3),
('VIP洽谈室', 6, '5F', 'B区501室', '["4K投影", "智能白板", "音响", "视频会议", "茶具"]', '高端洽谈室，配备茶歇服务', TRUE, 'vip', 4),
('董事会议室', 16, '5F', 'B区502室', '["4K投影", "智能白板", "音响", "视频会议", "同声传译", "电子表决"]', '董事级会议室，顶级配置', TRUE, 'vip', 5);

-- 插入示例管理员（企业微信登录后会自动创建）
-- INSERT INTO users (userid, name, role, department) VALUES ('admin', '系统管理员', 'admin', 'IT部');
