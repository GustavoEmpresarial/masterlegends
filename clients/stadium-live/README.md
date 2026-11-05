# MLL Stadium Live

Widget tipo **Taskbar Hero**: só o campo ao vivo + jogadores.

O app **nunca navega o jogo** — só Stadium Live (+ login se precisar). Qualquer tentativa de ir pra clube/scout/etc. volta pro campo.

Abre `http://143.20.50.96/club/stadium/live?widget=1` (ou `MLL_BASE_URL`).

## Artefatos prontos (`clients/stadium-live/release/`)

| Plataforma | Arquivo | Como usar |
|------------|---------|-----------|
| **Linux** | `MLL-Stadium-Live-1.0.0-linux.deb` | `sudo apt install ./MLL-Stadium-Live-1.0.0-linux.deb` |
| **Windows** | `MLL-Stadium-Live-1.0.0-windows.zip` | Extraia e rode `MLL Stadium Live.exe` |
| **Android** | `MLL-Stadium-Live-1.0.0-android-debug.apk` | `adb install -r …` |

Também gera AppImage: `MLL-Stadium-Live-1.0.0-linux.AppImage`

## Pré-requisito

Stack MLL no ar (`bash ./start.sh` na raiz) — o app é um shell do jogo live.

## Rebuild

```bash
cd clients/stadium-live
chmod +x scripts/*.sh

./scripts/build-linux.sh      # AppImage
./scripts/build-windows.sh    # zip com .exe
./scripts/build-android.sh    # APK debug
```

Dev rápido (Linux, sem empacotar):

```bash
./scripts/run-linux.sh
```

## Mobile — URL

- Emulador Android: `http://10.0.2.2:3000/club/stadium/live` (já no `capacitor.config.json`)
- Celular na mesma rede: edite `server.url` para o IP da máquina, ex. `http://192.168.0.10:3000/club/stadium/live`, depois `npx cap sync android && ./scripts/build-android.sh`

## Variáveis

| Var | Default | Uso |
|-----|---------|-----|
| `MLL_BASE_URL` | `http://143.20.50.96` | Origem do jogo (Electron) |
