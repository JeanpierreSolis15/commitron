# Contribuir a commitron

Español · [English](CONTRIBUTING.en.md)

Gracias por dedicarle tiempo. Esta guía explica cómo está organizado el
repositorio, cómo ejecutar todo en local, cómo fluyen los cambios entre ramas y
cómo se publica una release.

## Estructura del repositorio

```
main.go                     punto de entrada
internal/cli                flags, subcomandos, códigos de salida
internal/config             ajustes, valores por defecto, carga por capas, validación
internal/gitx               los comandos de git que commitron necesita
internal/message            limpieza, parseo y validación de la respuesta
internal/prompt             la plantilla del prompt y su renderizado
internal/provider           el backend de la CLI de Claude Code
internal/ui                 colores, glifos, spinner, preguntas al usuario
npm/                        el paquete npm: un lanzador que descarga el binario
schema.json                 JSON Schema de .commitron.json
install.sh, install.ps1     instaladores de una línea para los binarios de la release
.goreleaser.yaml            matriz de compilación y archivos de la release
```

El código Go no tiene dependencias de terceros y está escrito sin comentarios;
los nombres y las funciones pequeñas llevan el significado. Mantenlo así.

## Ejecutar todo en local

Necesitas Go 1.23 o superior y git. La CLI de Claude Code solo hace falta para
ejecutar commitron de principio a fin; la suite de tests no la llama.

```sh
go build ./...
go vet ./...
gofmt -l .
go test ./... -count=1
```

Para probar un cambio de verdad, compílalo y ejecútalo contra este repositorio:

```sh
go build -o commitron .
git add -p
./commitron --dry-run
```

### El paquete npm

`npm/` contiene un pequeño lanzador en Node. En la primera ejecución,
`bin/commitron.js` descarga desde GitHub el binario de la release para la
plataforma actual (`lib/download.js`), lo comprueba contra `checksums.txt` y lo
ejecuta. No hay scripts de instalación: npm 12 ya no los ejecuta por defecto.
Para probar el lanzador sin una release, deja un build local donde lo pondría la
descarga:

```sh
mkdir -p npm/vendor
go build -o npm/vendor/commitron .        # commitron.exe en Windows
node npm/bin/commitron.js version         # imprime: dev
```

`npm/package.json` mantiene la versión `0.0.0-dev`; el workflow de release pone
la real a partir del tag. No la cambies a mano.

## Ramas

| rama | papel |
|---|---|
| `main` | producción. Cada commit es publicable. Las releases son tags sobre esta rama. |
| `develop` | integración. Las ramas de trabajo nacen aquí y vuelven a fusionarse aquí. |

1. Crea tu rama desde `develop`: `git switch -c feat/nombre-corto develop`.
2. Commitea con Conventional Commits. Usa el propio commitron.
3. Abre un pull request contra `develop`. CI debe estar en verde: tests en Linux,
   macOS y Windows, `gofmt`, `goreleaser check` y la comprobación del paquete npm.
4. Cuando `develop` esté listo para salir, un mantenedor abre un pull request de
   `develop` a `main`, lo fusiona y etiqueta la release.

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
`chore`, `style`, `revert`. El scope es el paquete tocado (`cli`, `config`,
`gitx`, `message`, `prompt`, `provider`, `ui`, `npm`) o `ci`, `docs`,
`release`. Los commits `feat` y `fix` son los que acaban en las notas de la
release.

## Releases

Una release es un tag sobre `main`:

```sh
git switch main
git pull
git tag -a v1.2.3 -m "v1.2.3"
git push origin v1.2.3
```

El workflow de Release entonces:

1. compila los binarios para Linux, macOS y Windows en amd64 y arm64;
2. sube los archivos, los binarios sueltos y `checksums.txt` a una release de
   GitHub con un changelog agrupado por tipo;
3. publica `commitron@1.2.3` en npm con provenance. Un tag de pre-release como
   `v1.3.0-rc.1` se publica bajo el dist-tag `next` en lugar de `latest`.

### Configuración inicial para mantenedores

- **Secreto `NPM_TOKEN`.** Crea un token de automatización en npm (npmjs.com →
  Access Tokens → Granular, con permiso de publicar y "bypass 2FA") y añádelo
  como secreto del repositorio con el nombre `NPM_TOKEN`. Sin él, el paso de npm
  se salta con un aviso; la release de GitHub no se ve afectada.
- **Nombre del paquete.** Es el `name` de `npm/package.json`. Si el registro
  rechaza el nombre sin scope, cambia a uno con scope como
  `@jeanpierresolis15/commitron`; nada más tiene que cambiar.
- **Homebrew y Scoop** son opcionales y están documentados en `.goreleaser.yaml`.
- **Badges.** Los badges de release y npm solo se renderizan cuando hay algo
  publicado, así que aún no están en los README. Tras la primera publicación,
  añade estas dos líneas bajo el badge de CI en `README.md` y `README.en.md`:

  ```markdown
  [![Release](https://img.shields.io/github/v/release/JeanpierreSolis15/commitron?sort=semver)](https://github.com/JeanpierreSolis15/commitron/releases)
  [![npm](https://img.shields.io/npm/v/commitron)](https://www.npmjs.com/package/commitron)
  ```

## Reportar problemas

Abre un issue con la versión de commitron (`commitron version`), tu sistema
operativo, el comando que ejecutaste y qué esperabas. La salida de
`commitron --dry-run` y tu `.commitron.json` ayudan mucho. Nunca pegues un diff
que no puedas compartir.
