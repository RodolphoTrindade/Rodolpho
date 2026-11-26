# 🦉 Central Família

Central de estudos para crianças: jogos educativos, estrelas, medalhas, missão do dia e uma **Fábrica de jogos**, que monta um jogo novo a partir das fotos ou do texto da matéria. Sem dependências, só Node.js.

## Como funciona

- **Primeiro acesso:** quem abrir o site primeiro cria a conta do **responsável** (nome e senha). Faça isso logo depois do deploy.
- **Dar acesso a outras crianças:** em *Painel do responsável → Pessoas → Dar acesso a alguém*. Cada criança recebe um **código secreto** (ex.: `LEAO-AB12`) e um **link de acesso**: com o link, ela entra direto e fica conectada naquele aparelho.
- **Quem joga o quê:** em *Jogos → Quem joga*, libere cada jogo para todos ou só para algumas crianças.
- **Minha central (criança):** cada criança escolhe avatar, cor favorita da tela e marca jogos favoritos com ❤️.
- **Progresso:** estrelas, melhor nota, quantas vezes jogou e quando.
- **Fábrica de jogos:** envie fotos do caderno ou do livro e/ou o texto da matéria → **Criar jogo com IA** → revise as perguntas → teste → salve. Também dá para montar o jogo à mão ou enviar um jogo pronto (`.html`). Contas de Matemática mostram a conta armada como apoio.

## Variáveis no Railway

| Variável | Para quê |
|---|---|
| `DATA_DIR=/data` | Guardar dados no volume (monte um volume em `/data`) |
| `ANTHROPIC_API_KEY` | Liga a criação de jogos com IA (chave em console.anthropic.com) |
| `ANTHROPIC_MODEL` | Opcional. Modelo usado pela Fábrica (padrão `claude-sonnet-5-5`) |

## Jogos que já vêm na central

Em `jogos/`: Missão Português, Missão Matemática e Missão Inglês do Samuel (jogos prontos), e o **Desafio da Tabuada** (quiz). Esses arquivos só abrem para quem fez login.

## Rodar localmente

```bash
npm start   # http://localhost:3000
```
