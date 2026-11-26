# 🎛️ Central Rodolpho

Uma tela única para controlar tudo: atalhos para sistemas e sites organizados por categoria, abertos **dentro da própria central em abas**, verificação de status (no ar / fora do ar), tarefas e notas rápidas. Sem dependências — só Node.js.

## Subir no GitHub

Envie todos os arquivos desta pasta para a raiz do repositório `RodolphoTrindade/Rodolpho`:

```
package.json
server.js
default-data.json
railway.json
.gitignore
public/index.html
```

Pelo site: abra o repositório → **Add file → Upload files** → arraste os arquivos e a pasta `public` → **Commit changes**.

Ou pelo terminal:

```bash
git clone https://github.com/RodolphoTrindade/Rodolpho.git
cd Rodolpho
# copie os arquivos para cá
git add .
git commit -m "Central"
git push
```

## Publicar no Railway

1. Em **New Project → Deploy from GitHub repo**, escolha `RodolphoTrindade/Rodolpho`. O Railway detecta o Node e roda `npm start` sozinho.
2. Em **Variables**, crie `CENTRAL_PASSWORD` com uma senha (recomendado: sem ela, qualquer pessoa com o link vê e edita a central).
3. Para os dados **não se perderem a cada deploy**: clique com o botão direito no serviço → **Attach Volume**, monte em `/data` e crie a variável `DATA_DIR=/data`.
4. Em **Settings → Networking → Generate Domain** para ganhar o link público.

A cada `git push`, o Railway publica a nova versão automaticamente.

## Jogos de estudo da família

Os jogos ficam em `public/familia/` e abrem dentro da central (categoria **Família / Jogos de estudo**) ou direto pelo link:

- `/familia/portugues.html` — Missão Português do Samuel
- `/familia/matematica.html` — Missão Matemática do Samuel
- `/familia/ingles.html` — Missão Inglês do Samuel

Para incluir um jogo novo, coloque o `.html` nessa pasta e cadastre o link na central.

## Usar

- **＋ Adicionar**: cadastre qualquer sistema/site (nome, ícone, URL, categoria).
- **Clique no card**: abre em uma aba dentro da central. Sites que bloqueiam isso (GitHub, Gmail, Outlook, Railway e a maioria dos sistemas com login) abrem em nova aba automaticamente.
- **🩺 Status**: verifica quais sites estão no ar.
- **⋯ → Exportar backup**: baixa tudo em `.json`; **Importar** restaura.
- Tecla **/** foca a busca. Clique no título para renomear a central.

## Rodar localmente

```bash
npm start   # http://localhost:3000
```
