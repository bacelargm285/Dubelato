/**
 * charts.js — Todos os gráficos do Dubelato Dashboard
 * Cada função recebe dados já filtrados (do DB) e o ID do canvas.
 */

const Charts = (() => {

  // Registro de instâncias para destruir antes de recriar
  const instances = {};

  // ─── Paleta de cores ───────────────────────────────────────────────────────

  const C = {
    blue:     '#3b82f6',
    cyan:     '#06b6d4',
    green:    '#22c55e',
    red:      '#ef4444',
    orange:   '#f97316',
    purple:   '#a855f7',
    yellow:   '#eab308',
    pink:     '#ec4899',
    teal:     '#14b8a6',
    indigo:   '#6366f1',
    slate:    '#64748b',
    white:    '#f8fafc',
    gridLine: 'rgba(148,163,184,0.08)',
    textMuted:'rgba(148,163,184,0.6)',
  };

  const CATEGORY_COLORS = [
    C.blue, C.cyan, C.green, C.orange, C.purple,
    C.yellow, C.pink, C.teal, C.indigo, C.red,
    '#84cc16','#f43f5e','#8b5cf6','#0ea5e9','#d97706'
  ];

  // ─── Defaults globais do Chart.js ─────────────────────────────────────────

  function applyDefaults() {
    Chart.defaults.color = C.textMuted;
    Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.color = 'rgba(248,250,252,0.75)';
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.95)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(148,163,184,0.15)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = C.white;
    Chart.defaults.plugins.tooltip.bodyColor = 'rgba(248,250,252,0.8)';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.callbacks.label = ctx => {
      const v = ctx.parsed.y ?? ctx.parsed;
      if (typeof v === 'number') return ' ' + Utils.fmtCurrency(v);
      return ' ' + v;
    };
  }

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function register(id, chart) {
    instances[id] = chart;
    return chart;
  }

  // ─── Gráfico: Receita × Despesa (Barras mensais) ──────────────────────────

  function renderReceitaDespesa(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const byMes = Utils.groupBy(transactions, t => t.mes);
    const meses = Object.keys(byMes).sort();

    const entradas = meses.map(m =>
      Utils.sum(byMes[m].filter(t => t.tipo === 'Entrada').map(t => t.valor)));
    const saidas = meses.map(m =>
      Utils.sum(byMes[m].filter(t => t.tipo === 'Saída').map(t => t.valor)));

    const labels = meses.map(m => {
      const d = new Date(m + '-01');
      return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });

    register(canvasId, new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Receitas',
            data: entradas,
            backgroundColor: 'rgba(34,197,94,0.75)',
            borderColor: C.green,
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Despesas',
            data: saidas,
            backgroundColor: 'rgba(239,68,68,0.65)',
            borderColor: C.red,
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${Utils.fmtCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { color: C.gridLine }, ticks: { color: C.textMuted } },
          y: {
            grid: { color: C.gridLine },
            ticks: { color: C.textMuted, callback: v => Utils.fmtCurrency(v) }
          }
        }
      }
    }));
  }

  // ─── Gráfico: Gastos por Categoria (Pizza/Doughnut) ───────────────────────

  function renderGastosPorCategoria(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const saidas = transactions.filter(t => t.tipo === 'Saída');
    const bycat  = {};
    saidas.forEach(t => {
      const cat = t.categoria || 'Outros';
      bycat[cat] = (bycat[cat] || 0) + t.valor;
    });

    const sorted = Utils.sortByValue(bycat);
    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([, v]) => v);

    register(canvasId, new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: CATEGORY_COLORS.slice(0, labels.length).map(c => c + 'cc'),
          borderColor: CATEGORY_COLORS.slice(0, labels.length),
          borderWidth: 1.5,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { animateRotate: true, duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: { position: 'right', labels: { padding: 14, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = ((ctx.parsed / Utils.sum(data)) * 100).toFixed(1);
                return ` ${Utils.fmtCurrency(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        }
      }
    }));
  }

  // ─── Gráfico: Fluxo Financeiro Mensal (Linha) ─────────────────────────────

  function renderFluxoMensal(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const byMes = Utils.groupBy(transactions, t => t.mes);
    const meses = Object.keys(byMes).sort();

    const lucros = meses.map(m => {
      const ent = Utils.sum(byMes[m].filter(t => t.tipo === 'Entrada').map(t => t.valor));
      const sai = Utils.sum(byMes[m].filter(t => t.tipo === 'Saída').map(t => t.valor));
      return ent - sai;
    });

    const labels = meses.map(m => {
      const d = new Date(m + '-01');
      return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });

    register(canvasId, new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Resultado Mensal',
          data: lucros,
          borderColor: C.cyan,
          backgroundColor: ctx => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(6,182,212,0.1)';
            const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, 'rgba(6,182,212,0.3)');
            grad.addColorStop(1, 'rgba(6,182,212,0)');
            return grad;
          },
          borderWidth: 2.5,
          pointBackgroundColor: lucros.map(v => v >= 0 ? C.green : C.red),
          pointBorderColor: 'transparent',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                const sign = v >= 0 ? '+' : '';
                return ` Resultado: ${sign}${Utils.fmtCurrency(v)}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: C.gridLine }, ticks: { color: C.textMuted } },
          y: {
            grid: { color: C.gridLine },
            ticks: {
              color: C.textMuted,
              callback: v => Utils.fmtCurrency(v)
            }
          }
        }
      }
    }));
  }

  // ─── Gráfico: Evolução do Caixa (Área) ────────────────────────────────────

  function renderEvolucaoCaixa(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Ordena transações por data e calcula saldo acumulado
    const sorted = [...transactions].sort((a, b) => a.date - b.date);
    let saldo = 0;
    const points = sorted.map(t => {
      saldo += t.tipo === 'Entrada' ? t.valor : -t.valor;
      return { x: t.date, y: saldo };
    });

    // Agrupa por data (último saldo do dia)
    const byDate = {};
    points.forEach(p => {
      const k = Utils.fmtDate(p.x);
      byDate[k] = p.y;
    });
    const labels = Object.keys(byDate);
    const data   = Object.values(byDate);

    register(canvasId, new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo Acumulado',
          data,
          borderColor: C.blue,
          backgroundColor: ctx => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(59,130,246,0.1)';
            const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, 'rgba(59,130,246,0.25)');
            grad.addColorStop(1, 'rgba(59,130,246,0)');
            return grad;
          },
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800 },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: C.gridLine },
            ticks: {
              color: C.textMuted,
              maxTicksLimit: 10,
              maxRotation: 0,
            }
          },
          y: {
            grid: { color: C.gridLine },
            ticks: { color: C.textMuted, callback: v => Utils.fmtCurrency(v) }
          }
        }
      }
    }));
  }

  // ─── Gráfico: Receita por Forma de Pagamento ──────────────────────────────

  function renderReceitaPorPagamento(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const entradas = transactions.filter(t => t.tipo === 'Entrada');
    const bypag = {};
    entradas.forEach(t => {
      const p = t.pagamento || 'Não informado';
      bypag[p] = (bypag[p] || 0) + t.valor;
    });

    const sorted = Utils.sortByValue(bypag);
    register(canvasId, new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{
          label: 'Receitas por Pagamento',
          data: sorted.map(([,v]) => v),
          backgroundColor: CATEGORY_COLORS.map(c => c + 'bb'),
          borderColor: CATEGORY_COLORS,
          borderWidth: 1,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: C.gridLine }, ticks: { color: C.textMuted, callback: v => Utils.fmtCurrency(v) } },
          y: { grid: { color: C.gridLine }, ticks: { color: C.textMuted } }
        }
      }
    }));
  }

  // ─── Gráfico: Despesas por Forma de Pagamento ─────────────────────────────

  function renderDespesasPorPagamento(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const saidas = transactions.filter(t => t.tipo === 'Saída');
    const bypag = {};
    saidas.forEach(t => {
      const p = t.pagamento || 'Não informado';
      bypag[p] = (bypag[p] || 0) + t.valor;
    });

    const sorted = Utils.sortByValue(bypag);
    register(canvasId, new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{
          label: 'Despesas por Pagamento',
          data: sorted.map(([,v]) => v),
          backgroundColor: 'rgba(239,68,68,0.55)',
          borderColor: C.red,
          borderWidth: 1,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: C.gridLine }, ticks: { color: C.textMuted, callback: v => Utils.fmtCurrency(v) } },
          y: { grid: { color: C.gridLine }, ticks: { color: C.textMuted } }
        }
      }
    }));
  }

  // ─── Gráfico: Histórico por Categoria (Radar/Barras empilhadas) ───────────

  function renderHistoricoCategoria(canvasId, transactions) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const saidas = transactions.filter(t => t.tipo === 'Saída');
    const byMes  = Utils.groupBy(saidas, t => t.mes);
    const meses  = Object.keys(byMes).sort();

    // Top 6 categorias por valor total
    const catTotals = {};
    saidas.forEach(t => { catTotals[t.categoria || 'Outros'] = (catTotals[t.categoria || 'Outros'] || 0) + t.valor; });
    const topCats = Utils.sortByValue(catTotals).slice(0, 6).map(([k]) => k);

    const labels = meses.map(m => {
      const d = new Date(m + '-01');
      return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });

    const datasets = topCats.map((cat, i) => ({
      label: cat,
      data: meses.map(m =>
        Utils.sum((byMes[m] || []).filter(t => t.categoria === cat).map(t => t.valor))),
      backgroundColor: CATEGORY_COLORS[i] + '99',
      borderColor: CATEGORY_COLORS[i],
      borderWidth: 1,
      borderRadius: 4,
    }));

    register(canvasId, new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
        scales: {
          x: { stacked: true, grid: { color: C.gridLine }, ticks: { color: C.textMuted } },
          y: { stacked: true, grid: { color: C.gridLine }, ticks: { color: C.textMuted, callback: v => Utils.fmtCurrency(v) } }
        }
      }
    }));
  }

  // ─── Mini-sparkline (para cards) ──────────────────────────────────────────

  function renderSparkline(canvasId, data, color = C.blue) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    register(canvasId, new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{ data, borderColor: color, borderWidth: 2,
          pointRadius: 0, tension: 0.4, fill: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    }));
  }

  return {
    applyDefaults,
    renderReceitaDespesa,
    renderGastosPorCategoria,
    renderFluxoMensal,
    renderEvolucaoCaixa,
    renderReceitaPorPagamento,
    renderDespesasPorPagamento,
    renderHistoricoCategoria,
    renderSparkline,
    destroy,
  };

})();
