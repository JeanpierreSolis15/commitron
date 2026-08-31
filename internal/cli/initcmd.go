package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/JeanpierreSolis15/commitron/internal/config"
	"github.com/JeanpierreSolis15/commitron/internal/gitx"
	"github.com/JeanpierreSolis15/commitron/internal/ui"
)

const starter = `{
  "$schema": "` + config.SchemaURL + `",

  "model": "sonnet",
  "language": "en",

  "subjectMaxLength": 72,
  "body": "auto",

  "exclude": ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "*.lock"],
  "instructions": null,

  "confirm": true
}
`

func runInit(argv []string) error {
	var global, full, force bool
	fs := newFlagSet("commitron init")
	fs.BoolVar(&global, "global", false, "")
	fs.BoolVar(&full, "full", false, "")
	fs.BoolVar(&force, "force", false, "")
	if err := fs.Parse(argv); err != nil {
		return fail(err.Error(), "run `commitron --help` to see the flags")
	}

	path, err := targetPath(global)
	if err != nil {
		return err
	}
	written, err := writeConfig(path, full, force)
	if err != nil {
		return err
	}
	fmt.Printf("wrote %s\n", written)
	return nil
}

func targetPath(global bool) (string, error) {
	if global {
		path, err := config.GlobalPath()
		if err != nil {
			return "", fail("could not find your config directory", err.Error())
		}
		return path, nil
	}
	root, err := gitx.RepoRoot()
	if err != nil {
		return "", fail("this is not a git repository", "use `commitron init --global` to write your user-wide config")
	}
	return filepath.Join(root, config.FileName), nil
}

func writeConfig(path string, full, force bool) (string, error) {
	if _, err := os.Stat(path); err == nil && !force {
		return "", fail(path+" already exists", "pass --force to overwrite it")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", fail("could not create "+filepath.Dir(path), err.Error())
	}

	content := starter
	if full {
		cfg := config.Defaults()
		cfg.Schema = config.SchemaURL
		data, err := json.MarshalIndent(cfg, "", "  ")
		if err != nil {
			return "", err
		}
		content = string(data) + "\n"
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", fail("could not write "+path, err.Error())
	}
	return path, nil
}

func offerInit(theme *ui.Theme, root string, cfg config.Config, flags commitFlags) (config.Config, error) {
	var path string
	switch theme.AskInit() {
	case ui.InitRepo:
		path = filepath.Join(root, config.FileName)
	case ui.InitGlobal:
		p, err := config.GlobalPath()
		if err != nil {
			return cfg, fail("could not find your config directory", err.Error())
		}
		path = p
	default:
		return cfg, nil
	}

	written, err := writeConfig(path, false, false)
	if err != nil {
		return cfg, err
	}
	fmt.Fprintf(os.Stderr, "  %s %s\n\n", theme.OK(theme.Glyph.OK), theme.Dim("wrote "+written))

	res, err := resolveConfig(root, flags)
	if err != nil {
		return cfg, err
	}
	return res.Config, nil
}

func runConfig(argv []string) error {
	var configPath string
	fs := newFlagSet("commitron config")
	fs.StringVar(&configPath, "config", "", "")
	if err := fs.Parse(argv); err != nil {
		return fail(err.Error(), "")
	}

	root, err := gitx.RepoRoot()
	if err != nil {
		root = ""
	}
	res, err := config.Load(root, configPath)
	if err != nil {
		return fail("invalid configuration", err.Error())
	}
	data, err := json.MarshalIndent(res.Config, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(data))

	if len(res.Sources) == 0 {
		fmt.Println("\n// built-in defaults only; run `commitron init` to create a config file")
		return nil
	}
	fmt.Println("\n// merged from, in order:")
	for _, s := range res.Sources {
		fmt.Println("//   " + s)
	}
	return nil
}
