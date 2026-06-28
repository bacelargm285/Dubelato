/**
 * dashboard.js — Cards KPI, páginas e lógica de exibição
 */

const Dashboard = (() => {

  let _DB = null; // referência ao DB global

  // ─── KPIs principais ───────────────────────────────────────────────────────

  function computeKPIs(transactions) {
    const entradas = transactions.filter(t => t.tipo === 'Entrada');
    const saidas   = transactions.filter(t => t.tipo === 'Saída');

    const totalEntradas = Utils.sum(entradas.map(t => t.valor));
    const totalSaidas   = Utils.sum(saidas.map(t => t.valor));
    const lucro         = totalEntradas - totalSaidas;
    const margem        = totalEntradas ? (lucro / totalEntradas) * 100 : 0;

    // Vendas (categoria Vendas + Vendas iFood)
    const vendas = Utils.sum(
      entradas.filter(t => t.categoria.toLowerCase().includes('venda')).map(t => t.valor)
    );

    // Ticket médio: total de vendas / número de dias com venda
    const diasComVenda = new Set(
      entradas.filter(t => t.categoria.toLowerCase().includes('venda'))
              .map(t => Utils.fmtDate(t.date))
    ).size;
    const ticketMedio = diasComVenda ? vendas / diasComVenda : 0;

    // Saldo acumulado atual (todas as transações em ordem)
    let saldoAtual = 0;
    [...transactions].sort((a,b) => a.date - b.date)
      .forEach(t => { saldoAtual += t.tipo === 'Entrada' ? t.valor : -t.valor; });

    // Por mês para comparação com anterior
    const byMes  = Utils.groupBy(transactions, t => t.mes);
    const meses  = Object.keys(byMes).sort();
    const ultimo = meses[meses.length - 1] || '';
    const penult = meses[meses.length - 2] || '';

    const mesAtual = byMes[ultimo] || [];
    const mesAnt   = byMes[penult] || [];

    const entAtual = Utils.sum(mesAtual.filter(t=>t.tipo==='Entrada').map(t=>t.valor));
    const entAnt   = Utils.sum(mesAnt.filter(t=>t.tipo==='Entrada').map(t=>t.valor));
    const saiAtual = Utils.sum(mesAtual.filter(t=>t.tipo==='Saída').map(t=>t.valor));
    const saiAnt   = Utils.sum(mesAnt.filter(t=>t.tipo==='Saída').map(t=>t.valor));
    const lucAtual = entAtual - saiAtual;
    const lucAnt   = entAnt - saiAnt;

    return {
      totalEntradas, totalSaidas, lucro, margem, vendas,
      ticketMedio, saldoAtual, diasComVenda,
      entAtual, entAnt, saiAtual, saiAnt, lucAtual, lucAnt,
      mesAtual: ultimo, mesAnterior: penult,
    };
  }

  // ─── Render card KPI ──────────────────────────────────────────────────────

  function card(id, { icon, label, value, sub, subClass = '', trend = null, footer = '' }) {
    const el = document.getElementById(id);
    if (!el) return;

    let trendHtml = '';
    if (trend !== null && !isNaN(trend)) {
      const up = trend >= 0;
      const cls = up ? 'trend-up' : 'trend-down';
      const arrow = up ? '▲' : '▼';
      trendHtml = `<span class="card-trend ${cls}">${arrow} ${Utils.fmtPct(Math.abs(trend))} vs mês ant.</span>`;
    }

    el.innerHTML = `
      <div class="card-header-row">
        <span class="card-icon">${icon}</span>
        <span class="card-label">${label}</span>
      </div>
      <div class="card-value">${value}</div>
      ${sub ? `<div class="card-sub ${subClass}">${sub}</div>` : ''}
      ${trendHtml}
      ${footer ? `<div class="card-footer">${footer}</div>` : ''}
    `;

    // Animação de entrada
    el.classList.remove('card-animate');
    requestAnimationFrame(() => el.classList.add('card-animate'));
  }

  // ─── Página: Dashboard Principal ──────────────────────────────────────────

  function renderDashboard(DB, transactions) {
    _DB = DB;
    const kpi = computeKPIs(transactions);
    const hoje = new Date();

    // Boletos
    const boletosVencer7  = DB.boletos.filter(b => !b.vencido && (b.date - hoje) <= 7*86400000).length;
    const boletosVencer30 = DB.boletos.filter(b => !b.vencido && (b.date - hoje) <= 30*86400000).length;
    const boletosVencidos = DB.boletos.filter(b => b.vencido).length;
    const totalBoletos    = Utils.sum(DB.boletos.filter(b => !b.vencido).map(b => b.valor));
    const totalVencidos   = Utils.sum(DB.boletos.filter(b => b.vencido).map(b => b.valor));

    // Estoque
    const estoqueZerado   = DB.estoque.filter(i => i.qtNumber === 0).length;
    const estoqueBaixo    = DB.estoque.filter(i => i.qtNumber !== null && i.qtNumber > 0 && i.qtNumber <= 2).length;

    card('kpi-receita', {
      icon: '📈', label: 'Receita Total',
      value: Utils.fmtCurrency(kpi.totalEntradas),
      sub: `Mês atual: ${Utils.fmtCurrency(kpi.entAtual)}`,
      trend: Utils.pctChange(kpi.entAtual, kpi.entAnt),
    });

    card('kpi-despesa', {
      icon: '📉', label: 'Despesas Totais',
      value: Utils.fmtCurrency(kpi.totalSaidas),
      sub: `Mês atual: ${Utils.fmtCurrency(kpi.saiAtual)}`,
      trend: Utils.pctChange(kpi.saiAtual, kpi.saiAnt),
    });

    card('kpi-lucro', {
      icon: '💰', label: 'Resultado Líquido',
      value: Utils.fmtCurrency(kpi.lucro),
      sub: kpi.lucro >= 0 ? 'Saldo positivo' : 'Saldo negativo',
      subClass: kpi.lucro >= 0 ? 'text-green' : 'text-red',
      trend: Utils.pctChange(kpi.lucAtual, kpi.lucAnt),
    });

    card('kpi-saldo', {
      icon: '🏦', label: 'Saldo Acumulado',
      value: Utils.fmtCurrency(kpi.saldoAtual),
      sub: `Todas as transações`,
      subClass: kpi.saldoAtual >= 0 ? 'text-green' : 'text-red',
    });

    card('kpi-margem', {
      icon: '📊', label: 'Margem',
      value: Utils.fmtPct(kpi.margem),
      sub: kpi.margem >= 0 ? 'Margem positiva' : 'Margem negativa',
      subClass: kpi.margem >= 20 ? 'text-green' : kpi.margem >= 0 ? 'text-yellow' : 'text-red',
    });

    card('kpi-ticket', {
      icon: '🎫', label: 'Ticket Médio Diário',
      value: Utils.fmtCurrency(kpi.ticketMedio),
      sub: `${kpi.diasComVenda} dias com vendas`,
    });

    card('kpi-entradas', {
      icon: '⬆️', label: 'Total Entradas',
      value: Utils.fmtCurrency(kpi.totalEntradas),
      sub: `${transactions.filter(t=>t.tipo==='Entrada').length} lançamentos`,
    });

    card('kpi-saidas', {
      icon: '⬇️', label: 'Total Saídas',
      value: Utils.fmtCurrency(kpi.totalSaidas),
      sub: `${transactions.filter(t=>t.tipo==='Saída').length} lançamentos`,
    });

    card('kpi-estoque-qtd', {
      icon: '📦', label: 'Itens em Estoque',
      value: DB.estoque.length,
      sub: `${estoqueZerado} zerados · ${estoqueBaixo} baixo estoque`,
      subClass: estoqueZerado > 0 ? 'text-red' : 'text-muted',
    });

    card('kpi-boletos-vencer', {
      icon: '📋', label: 'Boletos a Vencer',
      value: Utils.fmtCurrency(totalBoletos),
      sub: `${boletosVencer7} nos próximos 7 dias · ${boletosVencer30} em 30 dias`,
      subClass: boletosVencer7 > 0 ? 'text-orange' : 'text-muted',
    });

    card('kpi-boletos-vencidos', {
      icon: '⚠️', label: 'Boletos Vencidos',
      value: Utils.fmtCurrency(totalVencidos),
      sub: `${boletosVencidos} boleto(s) em atraso`,
      subClass: boletosVencidos > 0 ? 'text-red' : 'text-green',
    });

    // Vendas
    const vendas = Utils.sum(
      transactions.filter(t => t.tipo==='Entrada' && t.categoria.toLowerCase().includes('venda'))
        .map(t => t.valor)
    );
    const ifood = Utils.sum(
      transactions.filter(t => t.tipo==='Entrada' && t.categoria.toLowerCase().includes('ifood'))
        .map(t => t.valor)
    );
    card('kpi-vendas', {
      icon: '🍨', label: 'Vendas (Balcão)',
      value: Utils.fmtCurrency(vendas - ifood),
      sub: `iFood: ${Utils.fmtCurrency(ifood)}`,
    });

    // Renderiza gráficos principais
    Charts.renderReceitaDespesa('chart-receita-despesa', transactions);
    Charts.renderGastosPorCategoria('chart-categorias', transactions);
    Charts.renderFluxoMensal('chart-fluxo', transactions);
    Charts.renderEvolucaoCaixa('chart-caixa', transactions);
    Charts.renderHistoricoCategoria('chart-hist-cat', transactions);
    Charts.renderReceitaPorPagamento('chart-rec-pagamento', transactions);
    Charts.renderDespesasPorPagamento('chart-sai-pagamento', transactions);

    // Top categorias de despesa
    Tables.renderTopCategorias('tbl-top-despesas', transactions, 'Saída', 8);
    Tables.renderTopCategorias('tbl-top-receitas', transactions, 'Entrada', 5);
  }

  // ─── Página: Lançamentos ──────────────────────────────────────────────────

  function renderLancamentos(DB, transactions, page = 1) {
    Tables.renderLancamentos('tbl-lancamentos', transactions, page);

    // Estatísticas rápidas
    const kpi = computeKPIs(transactions);
    const infoEl = document.getElementById('lancamentos-info');
    if (infoEl) {
      infoEl.innerHTML = `
        <span class="info-chip text-green">↑ ${Utils.fmtCurrency(kpi.totalEntradas)}</span>
        <span class="info-chip text-red">↓ ${Utils.fmtCurrency(kpi.totalSaidas)}</span>
        <span class="info-chip">${transactions.length} registros</span>
      `;
    }
  }

  // ─── Página: Estoque ──────────────────────────────────────────────────────

  function renderEstoque(DB) {
    const est = DB.estoque;
    const zerados = est.filter(i => i.qtNumber === 0);
    const baixo   = est.filter(i => i.qtNumber !== null && i.qtNumber > 0 && i.qtNumber <= 2);
    const semInfo = est.filter(i => i.qtNumber === null);

    card('kpi-est-total',  { icon:'📦', label:'Total Itens',   value: est.length,    sub: 'todos os itens cadastrados' });
    card('kpi-est-zerado', { icon:'🚫', label:'Estoque Zero',  value: zerados.length, sub: 'itens sem estoque', subClass: zerados.length?'text-red':'' });
    card('kpi-est-baixo',  { icon:'⚠️', label:'Estoque Baixo', value: baixo.length,   sub: 'qtd ≤ 2', subClass: baixo.length?'text-orange':'' });
    card('kpi-est-sem',    { icon:'❓', label:'Sem Quantidade', value: semInfo.length, sub: 'sem dado numérico' });

    // Tabela com busca
    renderEstoqueComBusca(DB.estoque, '');
  }

  function renderEstoqueComBusca(estoque, busca) {
    let filtered = estoque;
    if (busca) {
      const q = Utils.normalizeKey(busca);
      filtered = estoque.filter(i =>
        Utils.normalizeKey(i.item).includes(q) ||
        Utils.normalizeKey(i.categoria).includes(q)
      );
    }
    Tables.renderEstoque('tbl-estoque', filtered);
  }

  // ─── Página: Boletos ──────────────────────────────────────────────────────

  function renderBoletos(DB) {
    const hoje   = new Date();
    const todos  = DB.boletos;
    const futuros = todos.filter(b => !b.vencido);
    const vencidos= todos.filter(b => b.vencido);

    const p7  = futuros.filter(b => (b.date - hoje) <= 7*86400000);
    const p15 = futuros.filter(b => (b.date - hoje) <= 15*86400000);
    const p30 = futuros.filter(b => (b.date - hoje) <= 30*86400000);
    const p90 = futuros.filter(b => (b.date - hoje) <= 90*86400000);

    card('kpi-bol-7',    { icon:'📅', label:'Próx. 7 dias',  value: Utils.fmtCurrency(Utils.sum(p7.map(b=>b.valor))),  sub: `${p7.length} boletos`, subClass: p7.length?'text-orange':'' });
    card('kpi-bol-15',   { icon:'📅', label:'Próx. 15 dias', value: Utils.fmtCurrency(Utils.sum(p15.map(b=>b.valor))), sub: `${p15.length} boletos` });
    card('kpi-bol-30',   { icon:'📅', label:'Próx. 30 dias', value: Utils.fmtCurrency(Utils.sum(p30.map(b=>b.valor))), sub: `${p30.length} boletos` });
    card('kpi-bol-venc', { icon:'⚠️', label:'Vencidos',      value: Utils.fmtCurrency(Utils.sum(vencidos.map(b=>b.valor))), sub: `${vencidos.length} em atraso`, subClass: vencidos.length?'text-red':'' });

    Tables.renderBoletos('tbl-boletos', todos);
  }

  // ─── Página: Histórico ────────────────────────────────────────────────────

  function renderHistorico(DB, transactions) {
    Tables.renderResumoMes('tbl-historico-mes', transactions);
    Charts.renderFluxoMensal('chart-hist-fluxo', transactions);
    Charts.renderReceitaDespesa('chart-hist-barras', transactions);
  }

  // ─── Calendário Financeiro ────────────────────────────────────────────────

  function renderCalendario(DB, mesYM) {
    const [year, month] = mesYM.split('-').map(Number);
    const priDia = new Date(year, month - 1, 1);
    const ultDia = new Date(year, month, 0);
    const diaSemana = priDia.getDay(); // 0=dom

    const container = document.getElementById('calendario-grid');
    if (!container) return;

    // Pega boletos e transações do mês
    const boletosDoMes = DB.boletos.filter(b => b.mes === mesYM);
    const txDoMes = DB.transactions.filter(t => t.mes === mesYM);

    const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    let html = '<div class="cal-header">' + days.map(d => `<div class="cal-day-name">${d}</div>`).join('') + '</div>';
    html += '<div class="cal-body">';

    // Espaços em branco antes do primeiro dia
    for (let i = 0; i < diaSemana; i++) html += '<div class="cal-cell cal-empty"></div>';

    for (let d = 1; d <= ultDia.getDate(); d++) {
      const dataStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const bolDia  = boletosDoMes.filter(b => b.dia === d);
      const txDia   = txDoMes.filter(t => Utils.fmtDate(t.date) === Utils.fmtDate(new Date(year, month-1, d)));
      const entDia  = Utils.sum(txDia.filter(t=>t.tipo==='Entrada').map(t=>t.valor));
      const saiDia  = Utils.sum(txDia.filter(t=>t.tipo==='Saída').map(t=>t.valor));

      let cls = 'cal-cell';
      const hoje = new Date();
      if (d === hoje.getDate() && month === hoje.getMonth()+1 && year === hoje.getFullYear()) cls += ' cal-today';

      html += `<div class="${cls}">
        <span class="cal-num">${d}</span>
        ${entDia ? `<div class="cal-entry entry-green" title="Entradas">+${Utils.fmtCurrency(entDia)}</div>` : ''}
        ${saiDia ? `<div class="cal-entry entry-red" title="Saídas">-${Utils.fmtCurrency(saiDia)}</div>` : ''}
        ${bolDia.map(b => `<div class="cal-boleto" title="${b.descricao}">📋 ${b.descricao.slice(0,10)}</div>`).join('')}
      </div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    // Título do mês
    const titleEl = document.getElementById('cal-title');
    if (titleEl) {
      titleEl.textContent = priDia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
  }

  return {
    computeKPIs,
    card,
    renderDashboard,
    renderLancamentos,
    renderEstoque,
    renderEstoqueComBusca,
    renderBoletos,
    renderHistorico,
    renderCalendario,
  };

})();
