/**
 * tables.js — Tabelas interativas do Dubelato Dashboard
 */

const Tables = (() => {

  // ─── Helper: renderiza tabela genérica ────────────────────────────────────

  function render(containerId, { columns, rows, emptyMsg = 'Nenhum dado', className = '' }) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!rows.length) {
      el.innerHTML = `<div class="table-empty">${emptyMsg}</div>`;
      return;
    }

    const thead = columns.map(c => `<th>${c.label}</th>`).join('');
    const tbody = rows.map(row => {
      const cells = columns.map(c => {
        const val = typeof c.render === 'function' ? c.render(row) : (row[c.key] ?? '—');
        return `<td class="${c.class || ''}">${val}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    el.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table ${className}">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;
  }

  // ─── Tabela de Lançamentos ────────────────────────────────────────────────

  let txPage = 1;
  const TX_PAGE_SIZE = 50;

  function renderLancamentos(containerId, transactions, page = 1) {
    txPage = page;
    const start = (page - 1) * TX_PAGE_SIZE;
    const slice = transactions.slice(start, start + TX_PAGE_SIZE);
    const totalPages = Math.ceil(transactions.length / TX_PAGE_SIZE);

    render(containerId, {
      columns: [
        { label: 'Data', key: 'date', render: r => Utils.fmtDate(r.date) },
        { label: 'Descrição', key: 'descricao', render: r => `<span title="${r.descricao}">${Utils.truncate(r.descricao, 35)}</span>` },
        { label: 'Tipo', key: 'tipo', render: r => `<span class="badge badge-${r.tipo === 'Entrada' ? 'green' : 'red'}">${r.tipo}</span>` },
        { label: 'Categoria', key: 'categoria' },
        { label: 'Conta', key: 'conta' },
        { label: 'Pagamento', key: 'pagamento', render: r => r.pagamento || '—' },
        { label: 'Valor', key: 'valor', class: 'text-right',
          render: r => `<span class="${r.tipo === 'Entrada' ? 'text-green' : 'text-red'}">${Utils.fmtCurrency(r.valor)}</span>` },
        { label: 'Obs', key: 'obs', render: r => `<span class="text-muted">${Utils.truncate(r.obs, 25) || '—'}</span>` },
      ],
      rows: slice,
      emptyMsg: 'Nenhum lançamento encontrado para os filtros selecionados.',
    });

    // Paginação
    const pag = document.getElementById(containerId + '-pagination');
    if (pag && totalPages > 1) {
      pag.innerHTML = renderPagination(page, totalPages, 'txGoPage');
    } else if (pag) { pag.innerHTML = ''; }
  }

  // ─── Tabela de Estoque ────────────────────────────────────────────────────

  function renderEstoque(containerId, estoque) {
    render(containerId, {
      columns: [
        { label: 'Categoria', key: 'categoria' },
        { label: 'Item', key: 'item' },
        { label: 'Quantidade', key: 'quantidade', class: 'text-center',
          render: r => {
            const q = r.qtNumber;
            if (q === null || q === undefined) return `<span class="text-muted">${r.quantidade ?? '—'}</span>`;
            const cls = q === 0 ? 'text-red' : q <= 2 ? 'text-orange' : 'text-green';
            return `<span class="${cls}">${r.quantidade}</span>`;
          }
        },
        { label: 'Status', key: 'status', class: 'text-center',
          render: r => {
            const q = r.qtNumber;
            if (q === null || q === undefined) return '<span class="badge badge-slate">N/A</span>';
            if (q === 0) return '<span class="badge badge-red">Zerado</span>';
            if (q <= 2) return '<span class="badge badge-orange">Baixo</span>';
            return '<span class="badge badge-green">OK</span>';
          }
        },
        { label: 'Obs', key: 'obs', render: r => `<span class="text-muted">${r.obs || '—'}</span>` },
      ],
      rows: estoque,
      emptyMsg: 'Nenhum item de estoque.',
    });
  }

  // ─── Tabela de Boletos ────────────────────────────────────────────────────

  function renderBoletos(containerId, boletos, diasFiltro = null) {
    const hoje = new Date();
    let filtered = boletos;
    if (diasFiltro !== null) {
      const limite = new Date(hoje.getTime() + diasFiltro * 86400000);
      filtered = boletos.filter(b => b.date >= hoje && b.date <= limite);
    }

    filtered.sort((a, b) => a.date - b.date);

    render(containerId, {
      columns: [
        { label: 'Vencimento', key: 'date',
          render: r => {
            const cls = r.vencido ? 'text-red' : '';
            return `<span class="${cls}">${Utils.fmtDate(r.date)}</span>`;
          }
        },
        { label: 'Descrição', key: 'descricao' },
        { label: 'Mês Ref.', key: 'monthName' },
        { label: 'Valor', key: 'valor', class: 'text-right',
          render: r => `<span class="${r.vencido ? 'text-red' : 'text-white'}">${Utils.fmtCurrency(r.valor)}</span>` },
        { label: 'Status', key: 'status', class: 'text-center',
          render: r => r.vencido
            ? '<span class="badge badge-red">Vencido</span>'
            : '<span class="badge badge-blue">A vencer</span>' },
      ],
      rows: filtered,
      emptyMsg: 'Nenhum boleto no período selecionado.',
    });
  }

  // ─── Tabela de Cartão de Crédito ──────────────────────────────────────────

  function renderCartao(containerId, cartaoCredito) {
    const sorted = [...cartaoCredito].sort((a, b) => b.date - a.date);
    render(containerId, {
      columns: [
        { label: 'Data', key: 'date', render: r => Utils.fmtDate(r.date) },
        { label: 'Descrição', key: 'descricao', render: r => Utils.truncate(r.descricao, 40) },
        { label: 'Valor', key: 'valor', class: 'text-right',
          render: r => Utils.fmtCurrency(r.valor) },
        { label: 'Origem', key: 'sheet', render: r => `<span class="badge badge-slate">${r.sheet}</span>` },
      ],
      rows: sorted,
      emptyMsg: 'Nenhum lançamento de cartão.',
    });
  }

  // ─── Tabela Top Categorias ────────────────────────────────────────────────

  function renderTopCategorias(containerId, transactions, tipo = 'Saída', limit = 10) {
    const filtered = transactions.filter(t => t.tipo === tipo);
    const bycat = {};
    filtered.forEach(t => {
      const cat = t.categoria || 'Outros';
      bycat[cat] = (bycat[cat] || 0) + t.valor;
    });
    const total = Utils.sum(Object.values(bycat));
    const rows  = Utils.sortByValue(bycat).slice(0, limit).map(([cat, valor]) => ({
      categoria: cat, valor, pct: total ? (valor / total * 100) : 0
    }));

    render(containerId, {
      columns: [
        { label: '#', render: (r, i) => `<span class="text-muted">${rows.indexOf(r)+1}</span>` },
        { label: 'Categoria', key: 'categoria' },
        { label: 'Total', key: 'valor', class: 'text-right',
          render: r => Utils.fmtCurrency(r.valor) },
        { label: '% do Total', key: 'pct', class: 'text-right',
          render: r => {
            const pct = r.pct.toFixed(1);
            return `<div class="pct-bar-wrap">
              <div class="pct-bar" style="width:${r.pct}%;background:${tipo==='Saída'?'#ef4444':'#22c55e'}"></div>
              <span>${pct}%</span>
            </div>`;
          }
        },
      ],
      rows,
    });
  }

  // ─── Tabela Resumo por Mês ────────────────────────────────────────────────

  function renderResumoMes(containerId, transactions) {
    const byMes = Utils.groupBy(transactions, t => t.mes);
    const meses = Object.keys(byMes).sort().reverse();

    const rows = meses.map(m => {
      const ent = Utils.sum(byMes[m].filter(t => t.tipo === 'Entrada').map(t => t.valor));
      const sai = Utils.sum(byMes[m].filter(t => t.tipo === 'Saída').map(t => t.valor));
      const luc = ent - sai;
      const d   = new Date(m + '-01');
      return {
        mes: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        entradas: ent, saidas: sai, lucro: luc, margem: ent ? (luc/ent*100) : 0
      };
    });

    render(containerId, {
      columns: [
        { label: 'Mês', key: 'mes' },
        { label: 'Receitas', key: 'entradas', class: 'text-right',
          render: r => `<span class="text-green">${Utils.fmtCurrency(r.entradas)}</span>` },
        { label: 'Despesas', key: 'saidas', class: 'text-right',
          render: r => `<span class="text-red">${Utils.fmtCurrency(r.saidas)}</span>` },
        { label: 'Resultado', key: 'lucro', class: 'text-right',
          render: r => `<span class="${r.lucro>=0?'text-green':'text-red'}">${Utils.fmtCurrency(r.lucro)}</span>` },
        { label: 'Margem', key: 'margem', class: 'text-right',
          render: r => `<span class="${r.margem>=0?'text-green':'text-red'}">${Utils.fmtPct(r.margem)}</span>` },
      ],
      rows,
    });
  }

  // ─── Paginação ────────────────────────────────────────────────────────────

  function renderPagination(current, total, fnName) {
    let html = '<div class="pagination">';
    if (current > 1) html += `<button onclick="${fnName}(${current-1})">‹</button>`;
    const range = Array.from({length: Math.min(total, 7)}, (_, i) => {
      const p = current <= 4 ? i+1 : current - 3 + i;
      return p <= total ? p : null;
    }).filter(Boolean);
    range.forEach(p => {
      html += `<button class="${p===current?'active':''}" onclick="${fnName}(${p})">${p}</button>`;
    });
    if (current < total) html += `<button onclick="${fnName}(${current+1})">›</button>`;
    html += `<span class="pag-info">Página ${current} de ${total}</span></div>`;
    return html;
  }

  return {
    render,
    renderLancamentos,
    renderEstoque,
    renderBoletos,
    renderCartao,
    renderTopCategorias,
    renderResumoMes,
    txPage, TX_PAGE_SIZE,
  };

})();
