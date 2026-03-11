'use strict';

const slugify = require('slugify');

// ─── String Utils ────────────────────────────────────────────────────────────

function toSlug(text) {
  return slugify(text, { lower: true, strict: true, trim: true });
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function capitalizeWords(str) {
  if (!str) return '';
  return str.split(' ').map(capitalize).join(' ');
}

function truncate(str, maxLength = 100, suffix = '...') {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

function sanitizeString(str) {
  if (!str) return '';
  return str.replace(/[<>{}]/g, '').trim();
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const masked = local.slice(0, 2) + '*'.repeat(Math.max(0, local.length - 2));
  return `${masked}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return phone;
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

function generateUsername(firstName, lastName) {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${base}${suffix}`;
}

// ─── Object Utils ────────────────────────────────────────────────────────────

function pickFields(obj, fields) {
  return fields.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

function omitFields(obj, fields) {
  if (!obj) return {};
  const result = { ...obj };
  fields.forEach((key) => delete result[key]);
  return result;
}

function removeNullish(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '')
  );
}

function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function flattenObject(obj, prefix = '', separator = '.') {
  return Object.keys(obj).reduce((acc, key) => {
    const fullKey = prefix ? `${prefix}${separator}${key}` : key;
    if (isObject(obj[key]) && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], fullKey, separator));
    } else {
      acc[fullKey] = obj[key];
    }
    return acc;
  }, {});
}

// ─── Date Utils ──────────────────────────────────────────────────────────────

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isExpired(date) {
  return new Date(date) < new Date();
}

function formatDate(date, locale = 'en-US', options = {}) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(new Date(date));
}

// ─── Array Utils ─────────────────────────────────────────────────────────────

function chunk(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

function unique(array, key) {
  if (!key) return [...new Set(array)];
  const seen = new Set();
  return array.filter((item) => {
    const val = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const group = typeof key === 'function' ? key(item) : item[key];
    groups[group] = groups[group] ?? [];
    groups[group].push(item);
    return groups;
  }, {});
}

// ─── Number Utils ────────────────────────────────────────────────────────────

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

function roundTo(number, decimals = 2) {
  return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

module.exports = {
  // String
  toSlug,
  capitalize,
  capitalizeWords,
  truncate,
  sanitizeString,
  maskEmail,
  maskPhone,
  generateUsername,
  // Object
  pickFields,
  omitFields,
  removeNullish,
  deepMerge,
  isObject,
  flattenObject,
  // Date
  addDays,
  addHours,
  addMinutes,
  isExpired,
  formatDate,
  // Array
  chunk,
  unique,
  groupBy,
  // Number
  formatBytes,
  roundTo,
};
