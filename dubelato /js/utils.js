/**
 * utils.js — Utilitários globais do Dubelato Dashboard
 * Conversão de datas, formatação de moeda, helpers
 */

const Utils = (() => {

  // ─── Datas ────────────────────────────────────────────────────────────────

  /**
   * Converte número serial do Excel para objeto Date JS.
   * Lida com o bug de 1900 ser tratado como ano bissexto pelo Excel.
   */
  function excelSerialToDate(serial) {
    if (!serial || isNaN(serial)) return null;
    const s = Number(serial);
    if (s < 1 || s > 2958465) return null; // fora de range razoável
    // Ajuste para o bug de 1900 (Excel considera 29/fev/1900 que não existiu)
    const msPerDay = 86400 * 1000;
    const epoch = new Date(1899, 11, 30); // 30 dez 1899
    return new Date(epoch.getTime() + s * msPerDay);
  }

  /** Tenta parsear uma data de vários formatos possíveis. */
  function parseDate(value) {
    if (!value && value !== 0) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    const n = Number(value);
    if (!isNaN(n) && n > 100) return excelSerialToDate(n);
    // Tenta string "YYYY-MM-DD" ou "YYYY-MM"
    const str = String(value).trim();
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(str)) {
      const d = new Date(str + (str.length === 7 ? '-01' : ''));
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /** Formata Date para "DD/MM/YYYY". */
  function fmtDate(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : parseDate(date);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR');
  }

  /** Formata Date para "MMM/AAAA" (ex.: Jun/2026). */
  function fmtMonthYear(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : parseDate(date);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
            .replace('.', '').replace(' de ', '/');
  }

  /** Retorna "YYYY-MM" de uma Date. */
  function toYearMonth(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : parseDate(date);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /** Mapa de nome do mês PT → número (1-based). */
  const MONTH_NAME_MAP = {
    'janeiro':1,'fevereiro':2,'março':3,'marco':3,'abril':4,'maio':5,
    'junho':6,'julho':7,'agosto':8,'setembro':9,'outubro':10,
    'novembro':11,'dezembro':12,
    'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,
    'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12
  };

  function monthNameToNumber(name) {
    if (!name) return null;
    return MONTH_NAME_MAP[String(name).toLowerCase().trim()] || null;
  }

  // ─── Formatação monetária ──────────────────────────────────────────────────

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function fmtCurrency(value) {
    const n = Number(value);
    return isNaN(n) ? 'R$ —' : BRL.format(n);
  }

  function fmtNumber(value, decimals = 2) {
    const n = Number(value);
    if (isNaN(n)) return '—';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals
    }).format(n);
  }

  /** Formata variação percentual com sinal e cor. */
  function fmtPct(value) {
    const n = Number(value);
    if (isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}${fmtNumber(n, 1)}%`;
  }

  // ─── Helpers gerais ────────────────────────────────────────────────────────

  /** Normaliza string (trim, sem espaços duplos, lower). */
  function normalize(str) {
    return String(str || '').trim().replace(/\s+/g, ' ');
  }

  /** Normaliza para comparação (lowercase, sem acentos). */
  function normalizeKey(str) {
    return normalize(str).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Soma array de números (ignora NaN). */
  function sum(arr) {
    return arr.reduce((a, v) => a + (isNaN(v) ? 0 : Number(v)), 0);
  }

  /** Agrupa array de objetos por chave. */
  function groupBy(arr, keyFn) {
    return arr.reduce((acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  /** Ordena objeto por valor (desc). Retorna array de [key, value]. */
  function sortByValue(obj, desc = true) {
    return Object.entries(obj).sort(([, a], [, b]) => desc ? b - a : a - b);
  }

  /** Debounce simples. */
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /** Toast notification. */
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-msg">${message}</span>
    `;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-show'));
    setTimeout(() => {
      el.classList.remove('toast-show');
      el.addEventListener('transitionend', () => el.remove());
    }, duration);
  }

  /** Variação percentual entre dois valores. */
  function pctChange(current, previous) {
    if (!previous || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  /** Trunca texto com reticências. */
  function truncate(str, maxLen = 30) {
    const s = normalize(str);
    return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
  }

  /** Converte bytes em string legível. */
  function fmtBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return {
    excelSerialToDate, parseDate, fmtDate, fmtMonthYear, toYearMonth,
    monthNameToNumber, fmtCurrency, fmtNumber, fmtPct, normalize,
    normalizeKey, sum, groupBy, sortByValue, debounce, toast, pctChange,
    truncate, fmtBytes
  };

})();
