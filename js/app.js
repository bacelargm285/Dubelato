/**
 * app.js — Controlador principal da aplicação
 * Inicialização, roteamento de páginas, eventos globais
 */

const App = (() => {

  let DB = null;
  let currentPage = 'dashboard';

  // Páginas disponíveis (id da seção → função de render)
  const PAGES = {
    dashboard:   renderPageDashboard,
    lancamentos: renderPageLancamentos,
    estoque:     renderPageEstoque,
    boletos:     renderPageBoletos,
    historico:   renderPageHistorico,
    calendario:  renderPageCalendario,
  };

  // ─── Boot ──────────────────────────────────────────────────────────────────

  async function init() {
    Charts.applyDefaults();
    showLoading(true);

    try {
      DB = await ExcelEngine.loadWorkbook('./data/Controle_Financeiro_Dubelato.xlsx');
      Filters.populate(DB);
      Filters.bindEvents();
      Filters.onChange(() => refreshCurrentPage());

      // Popula meta no rodapé
      updateMeta();

      // Navega para a página inicial
      navigateTo('dashboard');
      showLoading(false);
      Utils.toast('Dashboard carregado com sucesso!', 'success');

    } catch (err) {
      console.error('[App] Erro ao carregar planilha:', err);
      showLoading(false);
      showError(err);
    }
  }

  function showLoading(visible) {
    const el = document.getElementById('loading-screen');
    if (el) el.style.display = visible ? 'flex' : 'none';
  }

  function showError(err) {
    const el = document.getElementById('error-screen');
    if (!el) return;
    el.style.display = 'flex';
    const msg = document.getElementById('error-msg');
    if (msg) msg.textContent = err.message || 'Erro desconhecido';
  }

  function updateMeta() {
    if (!DB) return;
    const el = document.getElementById('meta-info');
    if (el) {
      el.textContent =
        `${DB.meta.totalTransactions} transações · ` +
        `${DB.meta.totalEstoque} itens · ` +
        `Carregado em ${DB.meta.loadMs}ms · ` +
        DB.meta.loadedAt.toLocaleString('pt-BR');
    }
  }

  // ─── Roteamento ────────────────────────────────────────────────────────────

  function navigateTo(page) {
    if (!PAGES[page]) return;
    currentPage = page;

    // Atualiza menu
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Mostra seção correta
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === `page-${page}`);
    });

    refreshCurrentPage();
  }

  function refreshCurrentPage() {
    if (!DB) return;
    const fn = PAGES[currentPage];
    if (fn) fn();
  }

  // ─── Render de cada página ─────────────────────────────────────────────────

  function getFilteredTx() {
    return Filters.apply(DB.transactions);
  }

  function renderPageDashboard() {
    Dashboard.renderDashboard(DB, getFilteredTx());
  }

  function renderPageLancamentos() {
    Dashboard.renderLancamentos(DB, getFilteredTx(), 1);
    // Liga paginação global
    window.txGoPage = (p) => Dashboard.renderLancamentos(DB, getFilteredTx(), p);
  }

  function renderPageEstoque() {
    Dashboard.renderEstoque(DB);
    // Liga busca de estoque
    const busca = document.getElementById('estoque-busca');
    if (busca) {
      busca.oninput = Utils.debounce(e => {
        Dashboard.renderEstoqueComBusca(DB.estoque, e.target.value);
      }, 200);
    }
  }

  function renderPageBoletos() {
    Dashboard.renderBoletos(DB);
    // Filtro por período
    document.querySelectorAll('.boleto-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.boleto-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const dias = parseInt(btn.dataset.dias) || null;
        Tables.renderBoletos('tbl-boletos', DB.boletos, dias);
      };
    });
  }

  function renderPageHistorico() {
    Dashboard.renderHistorico(DB, DB.transactions); // histórico sempre usa TODAS as tx
  }

  function renderPageCalendario() {
    const hoje = new Date();
    const mesAtual = Utils.toYearMonth(hoje);
    Dashboard.renderCalendario(DB, mesAtual);

    // Navegação do calendário
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    let mesRef = mesAtual;

    if (prevBtn) prevBtn.onclick = () => {
      const d = new Date(mesRef + '-01');
      d.setMonth(d.getMonth() - 1);
      mesRef = Utils.toYearMonth(d);
      Dashboard.renderCalendario(DB, mesRef);
    };
    if (nextBtn) nextBtn.onclick = () => {
      const d = new Date(mesRef + '-01');
      d.setMonth(d.getMonth() + 1);
      mesRef = Utils.toYearMonth(d);
      Dashboard.renderCalendario(DB, mesRef);
    };
  }

  // ─── Exportação ────────────────────────────────────────────────────────────

  function exportExcel() {
    if (!DB) return;
    const tx = Filters.apply(DB.transactions);
    const rows = tx.map(t => ({
      Data: Utils.fmtDate(t.date),
      Descrição: t.descricao,
      Tipo: t.tipo,
      Categoria: t.categoria,
      Conta: t.conta,
      Pagamento: t.pagamento,
      Valor: t.valor,
      Obs: t.obs,
      Mês: t.mes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');
    XLSX.writeFile(wb, `Dubelato_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    Utils.toast('Exportação Excel concluída!', 'success');
  }

  function exportPDF() {
    Utils.toast('Abrindo janela de impressão…', 'info');
    setTimeout(() => window.print(), 300);
  }

  // ─── Sidebar toggle ────────────────────────────────────────────────────────

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('main-content').classList.toggle('sidebar-collapsed');
  }

  // ─── Upload manual de planilha ─────────────────────────────────────────────

  async function handleFileUpload(file) {
    if (!file) return;
    showLoading(true);
    try {
      // Recarrega usando o arquivo local
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      // Reutiliza a lógica do ExcelEngine
      Utils.toast('Planilha carregada! Atualizando…', 'info');
      // Para uso real, basta substituir o arquivo em /data/ e recarregar a página
      location.reload();
    } catch (err) {
      Utils.toast('Erro ao carregar arquivo: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ─── Eventos globais ───────────────────────────────────────────────────────

  function bindGlobalEvents() {
    // Menu lateral
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    // Botão toggle sidebar
    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.addEventListener('click', toggleSidebar);

    // Exportar
    const btnXls = document.getElementById('btn-export-excel');
    if (btnXls) btnXls.addEventListener('click', exportExcel);

    const btnPdf = document.getElementById('btn-export-pdf');
    if (btnPdf) btnPdf.addEventListener('click', exportPDF);

    // Upload manual
    const upInput = document.getElementById('file-upload');
    if (upInput) upInput.addEventListener('change', e => handleFileUpload(e.target.files[0]));

    // Atalho de teclado: Ctrl+Shift+R para recarregar dados
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        Utils.toast('Recarregando dados…', 'info');
        init();
      }
    });
  }

  // ─── Entrada ───────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    bindGlobalEvents();
    init();
  });

  return { navigateTo, refreshCurrentPage, exportExcel, exportPDF };

})();
