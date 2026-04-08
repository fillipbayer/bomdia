# Daily Board

Painel pessoal para boletins diarios, noticias, estudo de idiomas, agenda e tarefas.

Agora ele nao e so uma pagina estatica: existe um servidor local que busca RSS, monta boletins, salva historico por dia, sincroniza tarefas pelo backend e deixa o mesmo painel disponivel no desktop e no celular quando eles estiverem na mesma rede.

## Rodar

```bash
cd /Users/oto/Documents/Codex/daily-board
npm start
```

Para expor temporariamente na internet, rode com senha:

```bash
APP_USER=oto APP_PASSWORD="uma-senha-forte" npm start
```

Abra:

```text
http://localhost:4173
```

Para acessar no celular, descubra o IP do Mac na rede local e abra:

```text
http://IP-DO-MAC:4173
```

Exemplo:

```text
http://192.168.0.10:4173
```

## Rodar com Docker

```bash
docker build -t daily-board .
docker run --rm -p 4173:4173 \
  -e OPENAI_API_KEY="sua-chave" \
  -e DATA_DIR=/data \
  -v daily-board-data:/data \
  daily-board
```

## Configurar

Crie um arquivo local:

```bash
cp config.example.json config.json
```

Edite `config.json` para ajustar:

- `ownerName`: seu nome no boletim.
- `interests`: termos que ganham prioridade nas noticias.
- `newsFeeds`: fontes RSS por editoria.
- `calendar.icalUrl`: link iCal privado do Google Calendar, Apple Calendar ou Outlook.
- `morningBriefing`: horario em que o servidor prepara o boletim da manha se estiver rodando.
- `manualAgenda`: agenda fixa usada quando nao houver calendario conectado.
- `tts`: audio em arquivo. Com `OPENAI_API_KEY`, o servidor usa `gpt-4o-mini-tts`, salva MP3 em `data/audio/` e o player toca como podcast. Sem chave, o botao usa a voz do navegador como fallback.

Para ativar o audio premium com ElevenLabs:

```bash
export ELEVENLABS_API_KEY="sua-chave"
npm start
```

Se preferir usar OpenAI TTS:

```bash
export TTS_PROVIDER=openai
export OPENAI_API_KEY="sua-chave"
npm start
```

## O que funciona

- Noticias reais via RSS, com cache de 15 minutos.
- Editorias: Brasil, Mundo, Tecnologia, Cultura, Entretenimento e Esportes.
- Priorizacao simples baseada nos seus interesses.
- Boletim da manha criado automaticamente no horario configurado se o servidor estiver rodando.
- Boletim tambem e criado quando o dia e aberto pela primeira vez.
- Botao `Novo boletim` para gerar uma atualizacao do dia.
- Player de podcast no painel principal.
- TTS neural em MP3 com ElevenLabs ou OpenAI, quando a respectiva chave estiver configurada.
- Palavra diaria de ingles avancado e mandarim basico.
- Agenda por iCal quando configurada, com fallback manual.
- Tarefas salvas no backend.
- Historico por dia em `data/store.json`.
- Auto-refresh do painel aberto a cada 30 minutos.

## Endpoints

```text
GET  /api/health
GET  /api/runtime
GET  /api/day
POST /api/briefings
POST /api/tasks
PATCH /api/tasks/:id
```

## Colocar online

O app ja esta pronto para deploy como container. O ponto mais importante e usar armazenamento persistente em `/data`, porque ali ficam `store.json` e os MP3 em `audio/`.

### Render

1. Suba este projeto para um repositorio Git.
2. No Render, crie um Blueprint usando `render.yaml`.
3. Configure a variavel secreta `OPENAI_API_KEY`.
4. Garanta que o disco `daily-board-data` esta montado em `/data`.
5. O healthcheck deve apontar para `/api/health`.

### Fly.io

1. Crie o app com Docker.
2. Crie um volume chamado `daily_board_data` na regiao desejada.
3. Configure o segredo:

```bash
fly secrets set OPENAI_API_KEY="sua-chave"
```

4. Faça deploy com `fly.toml`.

### Railway

Railway detecta o `Dockerfile`. Configure:

- `OPENAI_API_KEY`
- `DATA_DIR=/data`
- `OWNER_NAME=Oto`
- `TIMEZONE=America/Sao_Paulo`
- `TTS_PROVIDER=elevenlabs`
- `OPENAI_TTS_MODEL=gpt-4o-mini-tts`
- `OPENAI_TTS_VOICE=marin`
- `ELEVENLABS_MODEL=eleven_multilingual_v2`
- `ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb`
- `TTS_RESPONSE_FORMAT=mp3_44100_128`

Use um volume persistente montado em `/data`.

## MVP gratis com link temporario

Para testar sem pagar deploy, rode o app no Mac e exponha com Cloudflare Tunnel:

```bash
APP_USER=oto APP_PASSWORD="uma-senha-forte" npm start
cloudflared tunnel --url http://localhost:4173
```

O Cloudflare vai mostrar um link publico temporario. Ao abrir, o navegador pede usuario e senha. Use o usuario e senha definidos nas variaveis acima.

## Limites atuais

- O painel ainda nao envia push notification nativo quando esta fechado.
- A integracao com calendario usa iCal privado, nao OAuth.
- As noticias vem de RSS; a qualidade depende das fontes escolhidas em `config.json`.
