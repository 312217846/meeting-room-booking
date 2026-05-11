/**
 * 手机号标准化工具
 * 支持中国大陆手机号（11位，1开头）和香港手机号（8位，5/6/7/8/9开头）
 * 
 * 标准化格式：
 *   大陆 → 纯11位数字（如 13800138000），与旧数据兼容
 *   香港 → +852 前缀（如 +85291234567）
 */

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');

  // 去掉国际区号前缀
  const withoutPrefix = digits.replace(/^86/, '').replace(/^852/, '');

  // 中国大陆手机号：11位，1[3-9]开头
  if (/^1[3-9]\d{9}$/.test(withoutPrefix)) {
    return withoutPrefix;  // 纯11位，兼容旧数据
  }

  // 香港手机号：8位，5/6/7/8/9开头
  if (/^[5-9]\d{7}$/.test(withoutPrefix)) {
    return `+852${withoutPrefix}`;
  }

  return null;
}

/** 别名，保持向后兼容 */
function normalizeHongKongPhone(value) {
  return normalizePhone(value);
}

function isValidHongKongPhone(value) {
  return normalizePhone(value) !== null;
}

module.exports = { normalizePhone, normalizeHongKongPhone, isValidHongKongPhone };
