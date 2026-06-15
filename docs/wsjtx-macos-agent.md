# HamHub WSJT-X Agent for macOS

Mac-agenten bruger samme WSJT-X core som Windows appen og sender data til production API:

```text
https://api.hamhub.dk
```

## Byg appen

På Apple Silicon:

```bash
./scripts/build-macos-agent.sh osx-arm64
```

På Intel Mac:

```bash
./scripts/build-macos-agent.sh osx-x64
```

Appen bliver bygget her:

```text
artifacts/hamhub-wsjtx-mac/HamHub WSJT-X Agent.app
```

## Kørsel

Start appen fra Finder eller Terminal. Første gang spørger den efter HamHub email,
password og WSJT-X UDP port. Standard API er allerede sat til `https://api.hamhub.dk`.

Config gemmes her:

```text
~/Library/Application Support/HamHub/wsjtx-agent.json
```

WSJT-X skal sende UDP til samme port som agenten lytter på. Standard er `2237`.
