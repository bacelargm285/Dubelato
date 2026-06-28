# Dubelato — Dashboard Financeiro

## Como usar

1. Abra `index.html` no navegador **ou** publique no GitHub Pages.
2. A planilha `data/Controle_Financeiro_Dubelato.xlsx` é carregada automaticamente.
3. Para atualizar os dados: substitua o arquivo Excel na pasta `data/` com o mesmo nome.

## Estrutura

```
Projeto/
├── index.html          ← Aplicação completa (SPA)
├── css/
│   ├── style.css       ← Tema dark, reset, tipografia
│   ├── dashboard.css   ← Layout sidebar/header/páginas
│   └── components.css  ← Cards, tabelas, gráficos
├── js/
│   ├── utils.js        ← Utilitários (datas, moeda, helpers)
│   ├── excel.js        ← DataEngine — lê e normaliza a planilha
│   ├── filters.js      ← Sistema de filtros globais
│   ├── charts.js       ← Todos os gráficos (Chart.js)
│   ├── tables.js       ← Tabelas interativas
│   ├── dashboard.js    ← Cards KPI e páginas
│   └── app.js          ← Inicialização e roteamento
└── data/
    └── Controle_Financeiro_Dubelato.xlsx  ← ÚNICA fonte de dados
```

## Filtros globais

Todos os gráficos e tabelas respondem aos filtros do header:
- **Mês / Ano** — período
- **Categoria, Conta, Pagamento, Tipo** — dimensões
- **Busca livre** — filtra descrição + categoria + obs

## Atalhos

- `Ctrl+Shift+R` — Recarrega a planilha sem recarregar a página
- Botão **Excel** — Exporta os lançamentos filtrados
- Botão **PDF** — Abre janela de impressão

## GitHub Pages

1. `git init && git add . && git commit -m "Dashboard Dubelato"`
2. `git remote add origin https://github.com/SEU_USUARIO/dubelato-dashboard`
3. `git push -u origin main`
4. Ative GitHub Pages: Settings → Pages → Source: `main` → `/root`

## Atualizar dados

Simplesmente substitua `data/Controle_Financeiro_Dubelato.xlsx` e faça push.
O dashboard recarrega automaticamente na próxima visita.
