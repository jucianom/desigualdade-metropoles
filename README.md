# Desigualdade nas Metrópoles — Painel de Indicadores

Painel estático (HTML/CSS/JS puro, sem build, sem framework) com indicadores de
desigualdade de renda nas Regiões Metropolitanas brasileiras. Desenvolvido para
o INCT Observatório das Metrópoles (UFRJ), PUCRS Data Social e RedODSAL.

## Arquitetura do projeto

```
.
├── index.html              # estrutura da página (não precisa mexer para trocar dados)
├── css/
│   └── styles.css          # todo o visual do painel (cores, tipografia, layout)
├── js/
│   └── app.js               # toda a lógica: filtros, cards, gráficos (SVG) e mapas (Leaflet)
├── data/
│   ├── meta.json            # configuração: RMs, anos, indicadores, cores, capitais (lat/lon)
│   ├── indicators.json      # os dados em si (uma série por indicador/ano/região)
│   └── states.geojson       # limites dos estados brasileiros (fundo dos mapas)
├── assets/
│   ├── sphere.svg            # símbolo estilizado do cabeçalho
│   └── logos/                # logos do rodapé (UFRJ, Observatório, PUCRS, RedODSAL)
└── README.md
```

Esta é uma arquitetura **"low code"**: não há passo de build (sem npm/webpack/
bundler), sem framework de front-end, sem dependências para instalar. É só
HTML/CSS/JS servido como arquivo estático — o próprio GitHub Pages já serve
isso sem nenhuma configuração extra. Para alterar o painel no dia a dia,
normalmente você só vai mexer em `data/*.json` (números) ou `css/styles.css`
(visual) — raramente em `js/app.js`.

### Por que os dados ficam em arquivos `.json` separados?

No protótipo original, tudo (dados, imagens, estilo, código) estava dentro de
um único arquivo HTML de ~800 KB. Isso funciona para testar rapidamente, mas
dificulta manutenção. Nesta versão:

- **`data/indicators.json`** — os valores de cada indicador, por ano e por
  região. É o arquivo que muda quando você tiver uma nova rodada de dados da
  PNAD Contínua.
- **`data/meta.json`** — a "configuração" do painel: lista de RMs, anos
  disponíveis, rótulos e formatação de cada indicador, paleta de cores,
  coordenadas das capitais. Editável sem tocar no código.
- **`data/states.geojson`** — o contorno dos estados usado como camada de
  fundo nos mapas (gerado a partir do shapefile do IBGE).

O `js/app.js` busca esses três arquivos com `fetch()` assim que a página
carrega, e a partir daí a interface é toda gerada dinamicamente — não há mais
nenhum dado "hardcoded" dentro do HTML ou do JS.

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `desigualdade-nas-metropoles`).
2. Faça upload de todos os arquivos e pastas deste pacote mantendo a mesma
   estrutura (a pasta `data/`, `css/`, `js/` e `assets/` precisam estar na
   raiz do repositório, no mesmo nível do `index.html`).
3. No repositório, vá em **Settings → Pages**.
4. Em **Source**, selecione **Deploy from a branch**, escolha a branch
   `main` (ou `master`) e a pasta `/ (root)`. Salve.
5. Em alguns minutos o GitHub publica o site em:
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

Não é necessário nenhum passo de build antes disso — o GitHub Pages serve os
arquivos exatamente como estão.

### Importante: abrir sempre via servidor (http/https), nunca com duplo-clique

Como o `app.js` usa `fetch()` para carregar os arquivos `data/*.json`, abrir o
`index.html` diretamente no navegador (protocolo `file://`, duplo-clique no
arquivo) **não funciona** — os navegadores bloqueiam `fetch()` local por
segurança. Para testar no seu computador antes de publicar, rode um
servidor local simples a partir da pasta do projeto:

```bash
# Python (já vem instalado na maioria dos sistemas)
python3 -m http.server 8000
# depois abra http://localhost:8000 no navegador
```

ou, com Node.js instalado:

```bash
npx serve .
```

No GitHub Pages isso já funciona automaticamente, pois o site é servido via
`https://`.

## Como atualizar os dados

1. Gere a nova série de dados (mesmo processo de sempre: planilhas por
   indicador, com uma linha por ano e uma coluna por RM/Conjunto/Brasil).
2. Substitua o conteúdo de `data/indicators.json` mantendo exatamente a mesma
   estrutura: `{ "indicador": { "ano": { "Região": valor, ... } } }`.
3. Se um novo ano for adicionado, inclua-o também na lista `"years"` dentro
   de `data/meta.json`.
4. Suba as alterações para o GitHub (`git push` ou upload direto pela
   interface web) — o Pages republica automaticamente.

## Dependências externas (via CDN, exigem internet)

O painel carrega duas coisas de fora, direto no navegador de quem acessa o
site (não precisam ser instaladas por você):

- **Leaflet** (`cdnjs.cloudflare.com`) — biblioteca dos mapas interativos.
- **CARTO / OpenStreetMap** — imagens de fundo (tiles) dos mapas.
- **Google Fonts** — a fonte Host Grotesk usada no painel.

Se algum desses serviços estiver bloqueado na rede de quem acessa o site, os
mapas ou a fonte podem não carregar — mas o restante do painel (cards,
gráficos, textos) continua funcionando normalmente, pois os gráficos e a
estrutura em si não dependem de nenhuma biblioteca externa.

## Navegadores suportados

Qualquer navegador moderno (Chrome, Firefox, Edge, Safari, atualizados nos
últimos ~3 anos). O painel usa SVG, CSS Grid/Flexbox e `fetch()` — todos com
suporte universal em navegadores atuais.
