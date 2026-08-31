# commitron

[![CI](https://github.com/JeanpierreSolis15/commitron/actions/workflows/ci.yml/badge.svg)](https://github.com/JeanpierreSolis15/commitron/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/JeanpierreSolis15/commitron?sort=semver)](https://github.com/JeanpierreSolis15/commitron/releases)
[![npm](https://img.shields.io/npm/v/%40deadgun15%2Fcommitron)](https://www.npmjs.com/package/@deadgun15/commitron)
[![Node](https://img.shields.io/node/v/%40deadgun15%2Fcommitron)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Español · [English](README.en.md)

Mensajes de commit generados con IA a partir de tu diff *staged*, escritos por la
**CLI de Claude Code** que ya tienes instalada. Sin API key, sin crear cuentas,
sin pagar dos veces: si `claude` funciona en tu máquina, esto también.

<p align="center">
  <img src="https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/docs/demo.svg" alt="commitron en una terminal: lee el diff staged, consulta al modelo, muestra un mensaje en formato Conventional Commits y espera confirmación antes de commitear" width="680">
</p>

- **Conventional Commits de serie.** Los valores por defecto replican
  `@commitlint/config-conventional`, así que el mensaje pasa tu hook de commitlint
  tal cual.
- **Conoce tu proyecto.** Aprende de tus últimos commits, y tus reglas, scopes y
  ejemplos en `.commitron.json` prevalecen sobre las genéricas.
- **Cualquier lenguaje, cualquier repositorio.** Solo necesita Node y no arrastra
  ninguna dependencia. Lee `git`, no `package.json`.
- **Tus palabras, tu decisión.** Te muestra el mensaje y tú confirmas, editas o
  cancelas. Nada se commitea a tus espaldas.

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior
- [git](https://git-scm.com)
- la [CLI de Claude Code](https://claude.com/claude-code) en tu PATH y con sesión
  iniciada. commitron ejecuta `claude -p` por debajo, así que usa la suscripción
  que ya tienes.

## Instalación

Funciona en macOS, Linux y Windows. Es JavaScript puro: no descarga binarios ni
ejecuta scripts de instalación, así que funciona igual con `--ignore-scripts` y
en Windows con Smart App Control activado.

```sh
npm install -g @deadgun15/commitron
```

O sin instalar nada:

```sh
npx @deadgun15/commitron
```

O por proyecto, junto al resto de tu tooling:

```sh
npm install --save-dev @deadgun15/commitron
```

El comando instalado se llama `commitron` en los tres casos.

```json
{
  "scripts": {
    "commit": "commitron"
  }
}
```

### Si vienes de 0.1.x

Hasta la 0.1.3 commitron era un binario compilado en Go. Si lo instalaste con
`install.sh`, `install.ps1` o `go install`, ese binario sigue en tu PATH y no se
actualiza solo: bórralo (`~/.local/bin/commitron`, `/usr/local/bin/commitron` o
`%LOCALAPPDATA%\Programs\commitron`) e instala con npm. Tu `.commitron.json`
vale tal cual.

## Uso

```sh
git add .
commitron
```

commitron lee lo que está *staged*, le pide el mensaje al modelo, lo muestra y
espera tu respuesta:

- `Y` o Enter commitea
- `e` abre antes el mensaje en tu editor de git
- `n` cancela

| flag | |
|---|---|
| `-m, --model <name>` | modelo para esta ejecución (`sonnet`, `opus`, `haiku` o un id de modelo completo) |
| `-e, --edit` | abre el mensaje en tu editor de git antes de commitear |
| `-y, --yes` | omite la confirmación; si el mensaje aún incumple alguna regla, no commitea |
| `--dry-run` | imprime el mensaje y se detiene |
| `--config <path>` | carga un archivo de configuración adicional por encima del resto |
| `--no-verify` | omite los hooks de git |
| `--color <mode>` | `auto` \| `always` \| `never` |

Los pipes funcionan como esperas: la salida bonita va a stderr, así que
`commitron --dry-run > msg.txt` te deja el mensaje plano en el archivo.

Un alias de git lo deja a mano:

```sh
git config --global alias.ai '!commitron'
git ai
```

Otros comandos:

```sh
commitron init           # crea .commitron.json con las claves habituales
commitron init --full    # todas las claves
commitron init --global  # tus valores por defecto para todos los repositorios
commitron config         # qué está en vigor y de dónde sale cada valor
commitron version
```

Cada comando acepta solo sus propios flags (`init` tiene `--global`, `--full` y
`--force`; `config` solo `--config`); `commitron --help` los lista todos.

## Configuración

La primera ejecución en un repositorio ofrece crear `.commitron.json`. También
puedes escribirlo tú:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/schema.json",
  "model": "sonnet",
  "language": "es",
  "scopes": ["api", "web", "infra"],
  "guidelines": ["Prefix the description with the Jira ticket from the branch name, e.g. ABC-123"],
  "exclude": ["pnpm-lock.yaml"]
}
```

Esa línea `$schema` merece quedarse: los editores la usan para autocompletar,
mostrar documentación inline y validar cada clave, así que nunca tendrás que
buscarlas.

Los ajustes se combinan de menor a mayor precedencia:

```
defaults → config de usuario → package.json#commitron → .commitron.json → --config → flags
```

Cada capa solo sobrescribe las claves que declara, y una clave desconocida es un
error, no un fallo silencioso. Un proyecto JavaScript puede tenerlo todo en
`package.json` bajo la clave `"commitron"` en lugar de un archivo aparte.

### Claves que conviene conocer

- **`language`** — idioma de la descripción (`en`, `es`, o un nombre completo
  como `"Brazilian Portuguese"`). El tipo de Conventional Commits se mantiene en
  inglés.
- **`guidelines`** — tus reglas en texto, una por entrada: "usa el ticket de la
  rama como prefijo", "nunca menciones archivos en el asunto". Van al prompt por
  encima de las reglas genéricas, y es lo que hace útil a commitron en un
  repositorio con convenciones propias.
- **`scopes`** — los scopes permitidos, como `scope-enum` de commitlint. Vacío
  significa cualquiera; si lo defines, una respuesta con otro scope se rechaza
  (una sin scope sigue valiendo).
- **`examples`** y **`history`** — mensajes de tu proyecto que el modelo debe
  imitar. `examples` los escribes tú; `history` (10 por defecto) toma los últimos
  commits del repositorio. Las reglas mandan cuando el historial las contradice;
  `"history": 0` lo apaga.
- **`instructions`** — opcional: la ruta a un Markdown que ya tengas con las
  convenciones, como `CONTRIBUTING.md`, para no duplicarlas en el JSON.
- **`exclude`** — pathspecs de git que se dejan fuera del diff. Los lockfiles se
  excluyen por defecto: un `pnpm-lock.yaml` puede tener 10.000 líneas y dejaría
  tu cambio real fuera del presupuesto del modelo. Esos archivos siguen apareciendo
  en la lista de cambios, así que el mensaje puede mencionarlos.
- **`types`** — los tipos que el modelo puede usar. Una respuesta con cualquier
  otro se rechaza en lugar de commitearse.
- **`model`** y **`timeoutSeconds`** — qué modelo responde y cuánto esperar.
- **`retries`** — cuántas veces se le pide al modelo que corrija una respuesta
  que incumple alguna regla (asunto demasiado largo, mayúscula inicial, cuerpo
  que falta…) antes de mostrártela. 1 por defecto; `0` muestra la primera tal
  cual.

Ejecuta `commitron init --full` para ver todas las claves con su valor por
defecto.

## commitlint

Los valores por defecto replican `@commitlint/config-conventional`, así que lo que
commitron escribe pasa un hook de commitlint tal cual. Algunas reglas se cumplen
reescribiendo el mensaje; el resto, avisándote:

| regla de commitlint | commitron |
|---|---|
| `type-enum` | **rechazado** — la respuesta debe usar uno de los `types` configurados |
| `subject-empty`, `type-empty`, `header-trim` | **rechazado** — una respuesta así no se podría parsear |
| `type-case` (lower-case) | corregido al salir |
| `subject-full-stop` | corregido al salir |
| `body-leading-blank` | corregido al salir |
| `body-max-line-length` | cuerpo ajustado a `bodyMaxLineLength` (100) |
| `header-max-length` | aviso si supera `subjectMaxLength` (72 aquí; el valor por defecto de commitlint es 100) |
| `subject-case` | aviso, salvo que la primera palabra sea un nombre o acrónimo como OAuth o API |
| `scope-case` | aviso; usa `"scopeCase": "any"` para scopes del estilo `feat(Chip)` |

La división es deliberada: una corrección puramente mecánica se aplica sin
preguntar, y lo que requiere criterio se deja en tus manos. Pasar `Feat:` a
minúsculas es seguro; pasar `OAuth` a minúsculas, no.

Cuando la respuesta deja algún aviso, commitron se la devuelve al modelo con la
lista de problemas y le pide una corrección (`retries`, 1 por defecto). Si aun
así queda alguno, en modo interactivo lo ves junto al mensaje y decides; con
`--yes` o `"confirm": false` no se commitea, porque nadie lo va a revisar.

commitron no sustituye a commitlint. Con `verify: true` (el valor por defecto) tu
propio hook `commit-msg` sigue ejecutándose y tiene la última palabra — la idea
es que no le quede nada de lo que quejarse.

## Cómo funciona

1. lee `git diff --cached`, sin las rutas excluidas, y tus últimos commits
2. renderiza un prompt con tu configuración, tus convenciones y esos ejemplos
3. se lo pasa por pipe a `claude -p --model <model> --tools "" --setting-sources ""
   --no-session-persistence --strict-mcp-config`, ejecutado desde un directorio
   vacío
4. desenvuelve, parsea y valida la respuesta
5. lo muestra y commitea con `git commit -F`

El paso 3 aísla la llamada a propósito: sin herramientas, sin `CLAUDE.md` (ni el
del proyecto ni el tuyo), sin hooks, sin MCP y sin guardar la sesión en disco. El
modelo solo ve el prompt, así que el mensaje depende del diff staged y de tu
configuración, y de nada más; `"isolated": false` lo desactiva si prefieres que
Claude Code cargue el contexto del proyecto como de costumbre. `claude` se
ejecuta como proceso hijo directo, así que un timeout mata el proceso real. El
diff no sale de tu máquina por ningún camino que no sea la CLI de Claude Code en
la que ya confías.

## Contribuir

Los issues y pull requests son bienvenidos. La versión corta:

- `main` es producción: cada merge desde `develop` publica una versión nueva,
  calculada a partir de los commits. `develop` es donde aterriza el trabajo: crea
  tu rama desde ahí y abre el pull request contra `develop`.
- Los mensajes de commit siguen Conventional Commits. commitron escribe los suyos,
  así que usar `commitron` en este repositorio es el flujo esperado.
- CI ejecuta la suite en Linux, macOS y Windows; `npm test`, `npm run lint` y
  `npm run format:check` deben estar limpios antes de un merge.

[CONTRIBUTING.md](CONTRIBUTING.md) tiene la guía completa: estructura del
repositorio, cómo ejecutar todo en local, el modelo de ramas y cómo se publica
una release.

## Licencia

[MIT](LICENSE). Puedes usar commitron para lo que quieras, incluido trabajo
comercial, y copiarlo, modificarlo y redistribuirlo, siempre que el aviso de
licencia lo acompañe. Se entrega sin ninguna garantía.
