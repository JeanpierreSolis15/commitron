# Contribuir a commitron

Español · [English](CONTRIBUTING.en.md)

Gracias por dedicarle tiempo. Esta guía explica cómo está organizado el
repositorio, cómo ejecutar todo en local, cómo fluyen los cambios entre ramas y
cómo se publica una release.

## Estructura del repositorio

```
src/main.ts                 punto de entrada: conecta los adaptadores y ejecuta la CLI
src/cli/                    flags, despacho de comandos, códigos de salida, informe de errores
src/app/                    casos de uso (commit, generate, init, config) y sus ports
src/domain/config/          tipo Config, valores por defecto, validación, decodificación
src/domain/message/         limpieza, parseo, validación y forma canónica del mensaje
src/domain/prompt/          el prompt y su renderizado
src/infra/                  adaptadores: git por spawn, CLI de Claude, archivos, terminal
src/ui/                     tema, vistas, spinner y preguntas sobre la terminal
src/utils/                  texto, errores, guards
test/                       espejo de src/; los dobles viven en test/helpers/fakes.ts
schema.json                 JSON Schema de .commitron.json
tsup.config.ts              empaquetado de src/ en dist/cli.js
```

Las capas dependen hacia dentro. `domain/` es lógica pura y no importa nada de
Node; `app/` solo habla con el exterior a través de las interfaces de
`app/ports.ts` (`GitClient`, `Provider`, `Files`, `Environment`, `Presenter`);
`infra/` y `ui/` las implementan; `main.ts` las conecta. Así los casos de uso se
prueban de principio a fin con dobles, sin git, sin `claude` y sin terminal.

El código no tiene dependencias en tiempo de ejecución y está escrito sin
comentarios; los nombres y las funciones pequeñas llevan el significado. Mantenlo
así.

## Ejecutar todo en local

Necesitas Node 20 o superior y git. La CLI de Claude Code solo hace falta para
ejecutar commitron de principio a fin; la suite de tests no la llama.

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

`npm run format` aplica Prettier; CI falla si queda algo sin formatear.

Para probar un cambio de verdad, compílalo y ejecútalo contra este repositorio:

```sh
npm run build
git add -p
node dist/cli.js --dry-run
```

`npm link` deja el comando `commitron` de este checkout disponible en todo el
sistema; `npm unlink -g @deadgun15/commitron` lo quita.

### El paquete

`npm pack --dry-run` muestra exactamente qué se publica: `dist/cli.js`,
`schema.json`, los README y la licencia. `package.json` mantiene la versión
`0.0.0-dev`; el workflow de release escribe la real, calculada a partir de los
commits, solo dentro del workflow. No la cambies a mano.

## Ramas

| rama | papel |
|---|---|
| `main` | producción. Cada merge desde `develop` publica una versión nueva si trae `feat` o `fix`. |
| `develop` | integración. Las ramas de trabajo nacen aquí y vuelven a fusionarse aquí. |

1. Crea tu rama desde `develop`: `git switch -c feat/nombre-corto develop`.
2. Commitea con Conventional Commits. Usa el propio commitron.
3. Abre un pull request contra `develop`. CI debe estar en verde: tests en Linux,
   macOS y Windows, lint y la comprobación del paquete npm.
4. Cuando `develop` esté listo para salir, un mantenedor abre un pull request de
   `develop` a `main` y lo fusiona; la release sale sola.

Ambas ramas deberían estar protegidas en GitHub (Settings → Branches → Add rule):
exigir pull request, exigir que pasen los checks de CI y prohibir los force push.
`main`, además, solo debería recibir merges desde `develop`.

## Mensajes de commit

Conventional Commits, tal como los produce commitron:

```
tipo(scope): descripción

- cuerpo opcional en viñetas
```

Tipos: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`,
`chore`, `style`, `revert`. El scope es la capa o el módulo tocado (`cli`,
`app`, `config`, `message`, `prompt`, `git`, `claude`, `terminal`, `ui`) o
`ci`, `docs`, `release`, `deps`. Los commits `feat` y `fix` son los que acaban en las notas de la
release.

## Releases

No hay tags ni números de versión a mano: **mergear `develop` en `main` es la
release**. En cada push a `main`, el workflow de Release ejecuta la suite,
compila `dist/cli.js` y lanza
[semantic-release](https://semantic-release.gitbook.io), que lee los
Conventional Commits desde el último tag y decide la versión:

| en los commits | versión |
|---|---|
| `!` o `BREAKING CHANGE` | minor mientras estemos en 0.x (`0.1.3 → 0.2.0`); major a partir de 1.0.0 |
| `feat` | minor |
| `fix`, `perf`, `revert` | patch |
| solo `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `style` | no se publica nada |

Con la versión decidida, la escribe en `package.json` (solo dentro del workflow;
en git sigue `0.0.0-dev`), publica `@deadgun15/commitron` en npm con
provenance, crea el tag `vX.Y.Z` y la release de GitHub con las notas agrupadas
por tipo, y comenta en cada pull request incluido en qué versión salió.

La regla "breaking = minor" vive en `.releaserc.json` (`releaseRules`). Para
salir a 1.0.0, quítala y mergea un commit con `BREAKING CHANGE`.

### Configuración inicial para mantenedores

- **Trusted publisher en npm.** El workflow publica sin ningún token: npm acepta
  el token OIDC que GitHub emite para `release.yml`. Se configura en npmjs.com →
  paquete → Settings → Trusted Publisher → GitHub Actions, con el usuario
  `JeanpierreSolis15`, el repositorio `commitron` y el workflow `release.yml`, y
  con la acción `npm publish` permitida. En "Publishing access" conviene
  "Require two-factor authentication and disallow bypass-2FA tokens": no afecta
  a OIDC y deja tu 2FA como único otro camino para publicar. npm autoriza por el
  nombre del archivo: si renombras `release.yml`, actualiza el trusted publisher
  o la publicación fallará.
- **semantic-release publica con `exec`, no con `@semantic-release/npm`.** El
  plugin oficial de npm exige un `NPM_TOKEN` y no entiende trusted publishing
  (issue abierto), así que `.releaserc.json` fija la versión con `npm version`
  y publica con `npm publish` a través de `@semantic-release/exec`; la release
  de GitHub la crea `@semantic-release/github` con el `GITHUB_TOKEN` del
  workflow. `conventional-changelog-conventionalcommits` va fijado a la versión
  8 porque la 10 necesita un `conventional-changelog-writer` más nuevo del que
  trae semantic-release. Para probar la configuración sin publicar:
  `GITHUB_TOKEN=<token> npx semantic-release --dry-run --no-ci --branches <rama>`.
- **Nombre del paquete.** Es `@deadgun15/commitron`: el scope es el usuario de
  npm del mantenedor, porque el nombre sin scope `commitron` pertenece a otra
  cuenta. El comando instalado sigue siendo `commitron` (`bin` en
  `package.json`).

## Reportar problemas

Abre un issue con la versión de commitron (`commitron version`), la de Node
(`node --version`), tu sistema operativo, el comando que ejecutaste y qué
esperabas. La salida de `commitron --dry-run` y tu `.commitron.json` ayudan
mucho. Nunca pegues un diff que no puedas compartir.
