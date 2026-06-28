/**
 * excel.js — DataEngine Dubelato
 * Lê o arquivo XLSX e normaliza TODAS as abas em um único objeto DB.
 * Arquitetura: cada módulo do sistema lê de DB, nunca do Excel diretamente.
 *
 * DB = {
 *   transactions : [...],  // Lançamentos + sheets mensais históricos
 *   estoque      : [...],  // Itens de estoque
 *   boletos      : [...],  // Boletos futuros
 *   cartaoCredito: [...],  // Cartão de crédito consolidado
 *   historico    : {...},  // Resumo por mês×categoria (de Detalhado)
 *   resumo       : {...},  // Visão geral (Resumo sheet)
 *   listas       : {...},  // Listas de referência
 *   meta         : {...},  // Metadados de carga
 * }
 */

const ExcelEngine = (() => {

  // Sheets que contêm transações (mesmo esquema de colunas)
  const TRANSACTION_SHEETS = [
    'NOV_25','DEZ_25','JAN_26','FEV_25','MAR_26','ABR_26','MAIO_26','Lançamentos'
  ];

  // Mapa de nome de mês PT (usado na sheet Boletos Futuros) → número
  const MONTH_NUM = {
    'janeiro':1,'fevereiro':2,'março':3,'marco':3,'abril':4,'maio':5,
    'junho':6,'julho':7,'agosto':8,'setembro':9,'outubro':10,'novembro':11,'dezembro':12
  };

  // ─── Parser de transações ──────────────────────────────────────────────────

  /**
   * Encontra o índice da linha de cabeçalho em uma sheet SheetJS.
   * Procura pela linha que contém "Tipo" ou "Descrição".
   */
  function findHeaderRow(aoa) {
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const row = aoa[i];
      if (!row) continue;
      const vals = row.map(c => Utils.normalizeKey(String(c ?? '')));
      if (vals.includes('tipo') || vals.includes('descricao') || vals.includes('descrição')) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Mapeia cabeçalhos encontrados para índices de colunas.
   * Busca por variações de nome (normalize + includes).
   */
  function mapHeaders(headerRow) {
    const map = {};
    const aliases = {
      data:        ['data'],
      descricao:   ['descrição','descricao','desc'],
      tipo:        ['tipo'],
      categoria:   ['categoria'],
      conta:       ['conta'],
      pagamento:   ['forma de pagamento','pagamento','forma pag'],
      valor:       ['valor'],
      obs:         ['obs','observação','observacao'],
      mes:         ['mês','mes'],
      saldo:       ['saldo acumulado','saldo'],
    };
    headerRow.forEach((cell, idx) => {
      const key = Utils.normalizeKey(String(cell ?? ''));
      for (const [field, names] of Object.entries(aliases)) {
        if (names.some(n => key === n || key.includes(n))) {
          if (!(field in map)) map[field] = idx; // primeiro match ganha
        }
      }
    });
    return map;
  }

  function parseTransactionSheet(aoa, sheetName) {
    const headerIdx = findHeaderRow(aoa);
    if (headerIdx < 0) return [];

    const headers = aoa[headerIdx];
    const colMap = mapHeaders(headers);
    const transactions = [];

    for (let r = headerIdx + 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row) continue;

      const rawDate  = row[colMap.data];
      const descricao = Utils.normalize(row[colMap.descricao] ?? '');
      const tipo      = Utils.normalize(row[colMap.tipo] ?? '');
      const categoria = Utils.normalize(row[colMap.categoria] ?? '');
      const conta     = Utils.normalize(row[colMap.conta] ?? '');
      const pagamento = Utils.normalize(row[colMap.pagamento] ?? '');
      const rawValor  = row[colMap.valor];
      const obs       = Utils.normalize(row[colMap.obs] ?? '');
      const rawMes    = row[colMap.mes];

      // Ignora linhas sem tipo válido
      if (!tipo || !['entrada','saída','saida'].includes(tipo.toLowerCase())) continue;
      // Ignora linhas com data absurda (ex: 329 = 1900)
      const dateSerial = Number(rawDate);
      if (!isNaN(dateSerial) && dateSerial < 40000) continue;

      const date = Utils.parseDate(rawDate);
      if (!date) continue;

      const valor = Number(rawValor) || 0;
      const tipoNorm = tipo.toLowerCase().startsWith('entrada') ? 'Entrada' : 'Saída';

      // Mês: prefere coluna Mês (string "YYYY-MM"), senão deriva da data
      let mes = '';
      if (rawMes) {
        const mesStr = String(rawMes).trim();
        if (/^\d{4}-\d{2}/.test(mesStr)) {
          mes = mesStr.slice(0, 7);
        } else {
          const d = Utils.parseDate(rawMes);
          if (d) mes = Utils.toYearMonth(d);
        }
      }
      if (!mes) mes = Utils.toYearMonth(date);

      transactions.push({
        date, mes, descricao, tipo: tipoNorm,
        categoria, conta, pagamento, valor, obs,
        sheet: sheetName
      });
    }
    return transactions;
  }

  // ─── Parser de estoque ────────────────────────────────────────────────────

  /**
   * O Estoque tem 4 grupos de colunas paralelas:
   * [Cat, Item, Qt, (vazio), Cat, Item, Qt, (vazio), Cat, Item, Qt, (vazio), Cat, Item, Qt, Obs]
   */
  function parseEstoque(aoa) {
    const items = [];
    if (!aoa || aoa.length < 2) return items;

    // Detecta a linha de cabeçalho procurando "Categoria" e "Item"
    let headerIdx = 0;
    for (let i = 0; i < Math.min(aoa.length, 5); i++) {
      const row = aoa[i] || [];
      const norm = row.map(c => Utils.normalizeKey(String(c ?? '')));
      if (norm.includes('categoria') && norm.includes('item')) { headerIdx = i; break; }
    }

    const header = aoa[headerIdx] || [];
    // Encontra todos os índices de "Categoria"
    const catIndices = [];
    header.forEach((cell, idx) => {
      if (Utils.normalizeKey(String(cell ?? '')) === 'categoria') catIndices.push(idx);
    });

    // Para cada grupo, Item = catIdx+1, Qt = catIdx+2, Obs = catIdx+4 (apenas último)
    for (let r = headerIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] || [];
      catIndices.forEach((catIdx, groupN) => {
        const cat  = Utils.normalize(row[catIdx] ?? '');
        const item = Utils.normalize(row[catIdx + 1] ?? '');
        const qt   = row[catIdx + 2];
        const obs  = Utils.normalize(row[catIdx + 4] ?? '');
        if (cat || item) {
          items.push({
            categoria: cat,
            item: item || '—',
            quantidade: qt !== undefined && qt !== null && qt !== '' ? qt : null,
            qtNumber: isNaN(Number(qt)) ? null : Number(qt),
            obs,
            group: groupN
          });
        }
      });
    }
    return items.filter(i => i.item && i.item !== '—');
  }

  // ─── Parser de boletos ────────────────────────────────────────────────────

  /**
   * Boletos Futuros tem layout horizontal:
   * Linha 0: [vazio, Março, vazio, vazio, vazio, Abril, ...]
   * Linha 1: [vazio, Data, Descrição, Valor, vazio, Data, ...]
   * Linhas de dados: dia do mês (número), descrição, valor
   */
  function parseBoletos(aoa) {
    const boletos = [];
    if (!aoa || aoa.length < 3) return boletos;

    // Linha com nomes de meses
    const monthRow = aoa[0] || [];
    // Linha com cabeçalhos por grupo
    const headerRow = aoa[1] || [];

    // Descobre os grupos (posição onde está o nome do mês)
    const groups = [];
    monthRow.forEach((cell, idx) => {
      const name = Utils.normalizeKey(String(cell ?? ''));
      const monthNum = MONTH_NUM[name];
      if (monthNum) {
        // Determina o ano: meses já passados são 2026 (ou 2027 se necessário)
        const now = new Date();
        let year = now.getFullYear();
        // Se o mês já passou neste ano, pode ser o próximo ciclo
        if (monthNum < now.getMonth() + 1) year = now.getFullYear();
        groups.push({ monthNum, year, startCol: idx, monthName: Utils.normalize(cell) });
      }
    });

    // Para cada grupo, extrai Data, Descrição, Valor
    // (colunas +0, +1, +2 a partir de startCol)
    for (let r = 2; r < aoa.length; r++) {
      const row = aoa[r] || [];
      groups.forEach(({ monthNum, year, startCol, monthName }) => {
        const dayRaw   = row[startCol];
        const desc     = Utils.normalize(row[startCol + 1] ?? '');
        const valorRaw = row[startCol + 2];

        const day = Number(dayRaw);
        if (!isNaN(day) && day >= 1 && day <= 31 && desc && String(desc).toLowerCase() !== 'total') {
          const valor = Number(valorRaw) || 0;
          const date = new Date(year, monthNum - 1, day);
          boletos.push({
            date,
            mes: `${year}-${String(monthNum).padStart(2, '0')}`,
            dia: day,
            descricao: desc,
            valor,
            monthName,
            vencido: date < new Date()
          });
        }
      });
    }

    return boletos.filter(b => b.valor > 0 || b.descricao);
  }

  // ─── Parser de cartão de crédito ──────────────────────────────────────────

  function parseCartaoCredito(sheets) {
    const entries = [];
    const cardSheets = ['Cartão Crédito','Cartao Dez','Dinheiro SN'];

    cardSheets.forEach(sheetName => {
      const aoa = sheets[sheetName];
      if (!aoa) return;

      // Procura linha de cabeçalho com "Data" e "Valor"
      let hIdx = -1;
      for (let i = 0; i < Math.min(aoa.length, 5); i++) {
        const row = aoa[i] || [];
        const norm = row.map(c => Utils.normalizeKey(String(c ?? '')));
        if (norm.includes('data') && norm.includes('valor')) { hIdx = i; break; }
      }
      if (hIdx < 0) return;

      const hRow = aoa[hIdx];
      const dataIdx  = hRow.findIndex(c => Utils.normalizeKey(String(c ?? '')) === 'data');
      const valorIdx = hRow.findIndex(c => Utils.normalizeKey(String(c ?? '')) === 'valor');
      const descIdx  = hRow.findIndex(c => Utils.normalizeKey(String(c ?? ''))
        .includes('descri'));

      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r] || [];
        const date = Utils.parseDate(row[dataIdx]);
        const valor = Number(row[valorIdx]) || 0;
        const desc = Utils.normalize(row[descIdx] ?? '');
        if (date && valor) {
          entries.push({ date, valor, descricao: desc, sheet: sheetName });
        }
      }
    });

    return entries;
  }

  // ─── Parser do Detalhado (histórico por categoria) ─────────────────────────

  function parseDetalhado(aoa) {
    if (!aoa) return {};
    const historico = {}; // { "2025-11": { Vendas: 128337, Salario: 20849, ... } }

    let currentMes = null;
    let mode = null; // 'income' | 'expense'

    for (const row of aoa) {
      if (!row) continue;
      const first = Utils.normalize(row[0] ?? '');
      const second = Utils.normalize(row[1] ?? '');

      // Detecta linha de mês: coluna B tem formato "YYYY-MM"
      if (/^\d{4}-\d{2}$/.test(second)) {
        currentMes = second.slice(0, 7);
        if (!historico[currentMes]) historico[currentMes] = {};
        continue;
      }

      if (!currentMes) continue;

      // Linhas de categoria: primeira coluna é nome, segunda é valor (entrada) ou
      // pode ter valor na posição 2 (saída precedida de vazio)
      const catName = first;
      const val1 = Number(row[1]);
      const val2 = Number(row[2]);

      if (catName && catName !== 'Mês' && catName !== 'TOTAL' &&
          catName !== 'Visão geral' && !/^\d{4}-\d{2}/.test(catName)) {
        if (!isNaN(val1) && val1 !== 0) {
          historico[currentMes][catName] = (historico[currentMes][catName] || 0) + val1;
        } else if (!isNaN(val2) && val2 !== 0) {
          historico[currentMes][catName] = (historico[currentMes][catName] || 0) + val2;
        }
      }
    }
    return historico;
  }

  // ─── Parser do Resumo ──────────────────────────────────────────────────────

  function parseResumo(aoa) {
    if (!aoa) return {};
    const result = {
      entradas: 0, saidas: 0, saldo: 0,
      porMes: {} // { "2026-06": { entradas, saidas, saldo } }
    };

    let inTable = false;
    for (const row of aoa) {
      if (!row) continue;
      const k = Utils.normalizeKey(String(row[0] ?? ''));
      const v = Number(row[1]);

      if (k === 'entradas') { result.entradas = v || 0; continue; }
      if (k === 'saidas' || k === 'saídas') { result.saidas = v || 0; continue; }
      if (k === 'saldo') { result.saldo = v || 0; continue; }
      if (k === 'mes' || k === 'mês') { inTable = true; continue; }

      if (inTable) {
        const mesStr = String(row[0] ?? '').trim();
        if (/^\d{4}-\d{2}/.test(mesStr)) {
          const mes = mesStr.slice(0, 7);
          const ent = Number(row[1]) || 0;
          const sai = Number(row[2]) || 0;
          const sal = Number(row[3]) || 0;
          if (ent || sai || sal) {
            result.porMes[mes] = { entradas: ent, saidas: sai, saldo: sal };
          }
        }
      }
    }
    return result;
  }

  // ─── Parser de Listas ──────────────────────────────────────────────────────

  function parseListas(aoa) {
    if (!aoa) return {};
    const result = { categorias: [], contas: [], pagamentos: [] };
    let hIdx = 0;
    for (let r = hIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] || [];
      if (row[0]) result.categorias.push(Utils.normalize(row[0]));
      if (row[1]) result.contas.push(Utils.normalize(row[1]));
      if (row[2]) result.pagamentos.push(Utils.normalize(row[2]));
    }
    // Remove vazios
    result.categorias = [...new Set(result.categorias.filter(Boolean))];
    result.contas     = [...new Set(result.contas.filter(Boolean))];
    result.pagamentos = [...new Set(result.pagamentos.filter(Boolean))];
    return result;
  }

  // ─── Carregamento principal ────────────────────────────────────────────────

  async function loadFile(url) {
    const response = await fetch(url + '?t=' + Date.now()); // evita cache
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const buffer = await response.arrayBuffer();
    return buffer;
  }

  /**
   * Carrega e processa o arquivo XLSX.
   * Retorna o objeto DB normalizado.
   */
  async function loadWorkbook(url = './data/Controle_Financeiro_Dubelato.xlsx') {
    const t0 = performance.now();

    // Carrega o arquivo
    const buffer = await loadFile(url);
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

    // Lê todas as sheets como array-of-arrays
    const sheets = {};
    wb.SheetNames.forEach(name => {
      sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1, defval: null, raw: true
      });
    });

    // ── Transações ──────────────────────────────────────────────────────────
    let transactions = [];
    TRANSACTION_SHEETS.forEach(sheetName => {
      if (sheets[sheetName]) {
        const parsed = parseTransactionSheet(sheets[sheetName], sheetName);
        transactions = transactions.concat(parsed);
      }
    });
    // Remove duplicatas óbvias (mesma data+desc+valor pode aparecer em sheets sobrepostas)
    // Prioriza o sheet mais recente (Lançamentos vem por último)
    const dedupKey = t => `${Utils.toYearMonth(t.date)}|${t.descricao}|${t.tipo}|${t.valor}`;
    const seen = new Set();
    const txDedup = [];
    // Inverte para manter o mais recente (Lançamentos) no caso de duplicatas
    [...transactions].reverse().forEach(t => {
      const k = dedupKey(t);
      if (!seen.has(k)) { seen.add(k); txDedup.push(t); }
    });
    transactions = txDedup.reverse();

    // Ordena por data
    transactions.sort((a, b) => a.date - b.date);

    // ── Estoque ─────────────────────────────────────────────────────────────
    const estoque = parseEstoque(sheets['Estoque']);

    // ── Boletos ─────────────────────────────────────────────────────────────
    const boletos = parseBoletos(sheets['Boletos Futuros']);

    // ── Cartão de Crédito ───────────────────────────────────────────────────
    const cartaoCredito = parseCartaoCredito(sheets);

    // ── Histórico (Detalhado) ────────────────────────────────────────────────
    const historico = parseDetalhado(sheets['Detalhado']);

    // ── Resumo ───────────────────────────────────────────────────────────────
    const resumo = parseResumo(sheets['Resumo']);

    // ── Listas ───────────────────────────────────────────────────────────────
    const listas = parseListas(sheets['Listas']);

    const t1 = performance.now();

    const DB = {
      transactions,
      estoque,
      boletos,
      cartaoCredito,
      historico,
      resumo,
      listas,
      meta: {
        loadedAt: new Date(),
        loadMs: Math.round(t1 - t0),
        sheetNames: wb.SheetNames,
        totalTransactions: transactions.length,
        totalEstoque: estoque.length,
        totalBoletos: boletos.length,
      }
    };

    console.log('[DataEngine] Carregado em', DB.meta.loadMs + 'ms', DB.meta);
    return DB;
  }

  /**
   * Carrega a partir de um File (input type=file) para uso futuro.
   */
  async function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const buffer = e.target.result;
          const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
          // Reutiliza a mesma lógica mas via ArrayBuffer
          const sheets = {};
          wb.SheetNames.forEach(name => {
            sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
              header: 1, defval: null, raw: true
            });
          });
          resolve({ wb, sheets });
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  return { loadWorkbook, loadFromFile };

})();
