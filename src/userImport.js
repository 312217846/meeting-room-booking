const { ROOM_TYPES } = require('./constants');
const { normalizeHongKongPhone } = require('./phone');

const IMPORT_COLUMNS = ['english_name', 'last_name', 'region', 'group_name', 'phone', 'level'];

function splitLine(line, delimiter) {
  if (delimiter === '\t') return line.split('\t').map(cell => cell.trim());
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function permissionsFromLevel(level) {
  const normalized = String(level || 'normal').trim().toLowerCase();
  if (normalized === 'training') return ['normal', 'training'];
  if (normalized === 'vip') return ['normal', 'vip'];
  if (normalized === 'all' || normalized === 'admin') return [...ROOM_TYPES];
  return ['normal'];
}

function parseUserImportText(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: [{ rowNumber: 1, message: '导入内容至少需要表头和一行用户数据' }] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitLine(lines[0], delimiter).map(header => header.trim());
  const missing = IMPORT_COLUMNS.filter(column => !headers.includes(column));
  if (missing.length > 0) {
    return { rows: [], errors: [{ rowNumber: 1, message: `缺少字段: ${missing.join(', ')}` }] };
  }

  const rows = [];
  const errors = [];

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = splitLine(line, delimiter);
    const raw = Object.fromEntries(headers.map((header, i) => [header, values[i] || '']));
    const phone = normalizeHongKongPhone(raw.phone);

    if (!phone) {
      errors.push({ rowNumber, message: '手机号必须是香港手机号' });
      return;
    }

    rows.push({
      english_name: raw.english_name.trim(),
      last_name: raw.last_name.trim(),
      region: raw.region.trim(),
      group_name: raw.group_name.trim(),
      phone,
      level: String(raw.level || 'normal').trim().toLowerCase(),
      booking_permissions: permissionsFromLevel(raw.level)
    });
  });

  return { rows, errors };
}

module.exports = { parseUserImportText, permissionsFromLevel, IMPORT_COLUMNS };
