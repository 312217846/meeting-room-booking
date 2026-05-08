function normalizeHongKongPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('852') ? digits.slice(3) : digits;
  if (!/^[569]\d{7}$/.test(local)) {
    return null;
  }
  return `+852${local}`;
}

function isValidHongKongPhone(value) {
  return normalizeHongKongPhone(value) !== null;
}

module.exports = { normalizeHongKongPhone, isValidHongKongPhone };
