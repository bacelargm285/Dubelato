/**
 * filters.js — Sistema de Filtros Globais
 * Estado centralizado. Todos os módulos ouvem mudanças via callback.
 */

const Filters = (() => {

  // Estado atual dos filtros
  let state = {
    mes: '',        // "2026-06" ou '' para todos
    ano: '',        // "2026" ou ''
    categoria: '',
    conta: '',
    pagamento: '',
    tipo: '',       // 'Entrada' | 'Saída' | ''
    busca: '',      // texto livre
  };

  // Callbacks registrados
  const listeners = [];

  function get() { return { ...state }; }

  function set(partial) {
    state = { ...state, ...partial };
    _notify();
  }

  function reset() {
    state = { mes:'', ano:'', categoria:'', conta:'', pagamento:'', tipo:'', busca:'' };
    _notify();
    _syncUI();
  }

  function _notify() {
    listeners.forEach(fn => {
      try { fn(get()); } catch(e) { console.error('[Filters] Listener error', e); }
    });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // ─── Aplicar filtros a array de transações ─────────────────────────────────

  /**
   * Filtra array de transactions conforme estado atual.
   */
  function apply(transactions) {
    const f = state;
    return transactions.filter(t => {
      if (f.mes && t.mes !== f.mes) return false;
      if (f.ano && !t.mes.startsWith(f.ano)) return false;
      if (f.categoria && Utils.normalizeKey(t.categoria) !== Utils.normalizeKey(f.categoria)) return false;
      if (f.conta && Utils.normalizeKey(t.conta) !== Utils.normalizeKey(f.conta)) return false;
      if (f.pagamento && Utils.normalizeKey(t.pagamento) !== Utils.normalizeKey(f.pagamento)) return false;
      if (f.tipo && t.tipo !== f.tipo) return false;
      if (f.busca) {
        const q = Utils.normalizeKey(f.busca);
        const haystack = Utils.normalizeKey(`${t.descricao} ${t.categoria} ${t.conta} ${t.obs}`);
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  // ─── Constrói UI de filtros ────────────────────────────────────────────────

  /**
   * Popula os selects de filtro com as opções disponíveis no DB.
   */
  function populate(DB) {
    const tx = DB.transactions;

    const categorias = [...new Set(tx.map(t => t.categoria).filter(Boolean))].sort();
    const contas     = [...new Set(tx.map(t => t.conta).filter(Boolean))].sort();
    const pagamentos = [...new Set(tx.map(t => t.pagamento).filter(Boolean))].sort();
    const meses      = [...new Set(tx.map(t => t.mes).filter(Boolean))].sort();
    const anos       = [...new Set(meses.map(m => m.slice(0,4)))].sort();

    _populateSelect('filter-mes', meses, m => {
      const d = new Date(m + '-01');
      return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    });
    _populateSelect('filter-ano', anos);
    _populateSelect('filter-categoria', categorias);
    _populateSelect('filter-conta', contas);
    _populateSelect('filter-pagamento', pagamentos);
  }

  function _populateSelect(id, options, labelFn) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Todos</option>' +
      options.map(o => `<option value="${o}">${labelFn ? labelFn(o) : o}</option>`).join('');
    if (current) el.value = current;
  }

  /** Sincroniza a UI com o estado atual (após reset). */
  function _syncUI() {
    const ids = ['filter-mes','filter-ano','filter-categoria','filter-conta','filter-pagamento','filter-tipo'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const busca = document.getElementById('filter-busca');
    if (busca) busca.value = '';
  }

  /**
   * Vincula eventos aos controles de filtro no DOM.
   * Chamado uma vez após renderizar o header.
   */
  function bindEvents() {
    const bind = (id, field) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        // Quando muda o mês, limpa o ano (e vice-versa) para evitar conflito
        if (field === 'mes' && el.value) set({ mes: el.value, ano: '' });
        else if (field === 'ano' && el.value) set({ ano: el.value, mes: '' });
        else set({ [field]: el.value });
      });
    };

    bind('filter-mes',       'mes');
    bind('filter-ano',       'ano');
    bind('filter-categoria', 'categoria');
    bind('filter-conta',     'conta');
    bind('filter-pagamento', 'pagamento');
    bind('filter-tipo',      'tipo');

    const buscaEl = document.getElementById('filter-busca');
    if (buscaEl) {
      buscaEl.addEventListener('input', Utils.debounce(e => {
        set({ busca: e.target.value });
      }, 250));
    }

    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Filtra meses quando ano muda (atualiza select de mês)
    const anoEl = document.getElementById('filter-ano');
    if (anoEl) {
      anoEl.addEventListener('change', () => {
        const ano = anoEl.value;
        const mesEl = document.getElementById('filter-mes');
        if (!mesEl) return;
        // Filtra opções de mês pelo ano selecionado
        [...mesEl.options].forEach(opt => {
          if (!opt.value) return; // "Todos"
          opt.hidden = ano ? !opt.value.startsWith(ano) : false;
        });
      });
    }
  }

  return { get, set, reset, apply, populate, bindEvents, onChange };

})();
