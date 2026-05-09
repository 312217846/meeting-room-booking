function getV2ColumnDefinitions() {
  return {
    users: {
      password_hash: 'VARCHAR(255) DEFAULT NULL',
      gender: "ENUM('unknown', 'male', 'female') DEFAULT 'unknown'",
      english_name: 'VARCHAR(100) DEFAULT NULL',
      last_name: 'VARCHAR(100) DEFAULT NULL',
      email: 'VARCHAR(100) DEFAULT NULL',
      region: 'VARCHAR(100) DEFAULT NULL',
      group_name: 'VARCHAR(100) DEFAULT NULL',
      booking_permissions: 'JSON DEFAULT NULL',
      daily_booking_limit_minutes: 'INT DEFAULT 180',
      is_active: 'BOOLEAN DEFAULT TRUE'
    },
    meeting_rooms: {
      room_type: "ENUM('normal', 'training', 'vip') DEFAULT 'normal'"
    }
  };
}

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.execute(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function ensureV2Schema(pool) {
  const definitions = getV2ColumnDefinitions();
  for (const [tableName, columns] of Object.entries(definitions)) {
    for (const [columnName, definition] of Object.entries(columns)) {
      if (!(await columnExists(pool, tableName, columnName))) {
        await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      }
    }
  }
  await pool.execute("UPDATE users SET booking_permissions = JSON_ARRAY('normal') WHERE booking_permissions IS NULL");
  await pool.execute("UPDATE meeting_rooms SET room_type = 'vip' WHERE is_vip = TRUE AND room_type = 'normal'");
  await pool.execute("INSERT INTO system_config (config_key, config_value, description) VALUES ('default_daily_booking_limit_minutes', '180', '默认每日预订上限（分钟）'), ('booking_max_days', '365', '最大可提前预订天数'), ('booking_purposes', '[\"见客\",\"招募\",\"培训\",\"讲座\",\"会议\",\"其他\"]', '预订用途选项') ON DUPLICATE KEY UPDATE config_value = CASE WHEN config_key = 'booking_max_days' AND config_value = '7' THEN VALUES(config_value) ELSE config_value END, description = VALUES(description)");
}

module.exports = { getV2ColumnDefinitions, ensureV2Schema };
