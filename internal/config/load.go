package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// FileName is the per-repository config file.
const FileName = ".commitron.json"

// PackageJSONKey is the key commitron reads inside a package.json.
const PackageJSONKey = "commitron"

// Result carries the resolved config plus the files it came from, so
// `commitron config` can explain where a value was set.
type Result struct {
	Config  Config
	Sources []string
}

// GlobalPath is the user-wide config: %AppData%\commitron\config.json on Windows,
// $XDG_CONFIG_HOME/commitron/config.json (or ~/.config/...) elsewhere.
func GlobalPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "commitron", "config.json"), nil
}

// Load merges every layer, lowest precedence first: defaults, global config,
// package.json#commitron, .commitron.json, then an explicit --config path.
// Each layer only overrides the keys it actually declares.
func Load(repoRoot, explicitPath string) (Result, error) {
	res := Result{Config: Defaults()}

	if global, err := GlobalPath(); err == nil {
		if err := applyFile(&res, global, false); err != nil {
			return res, err
		}
	}
	if repoRoot != "" {
		if err := applyPackageJSON(&res, filepath.Join(repoRoot, "package.json")); err != nil {
			return res, err
		}
		if err := applyFile(&res, filepath.Join(repoRoot, FileName), false); err != nil {
			return res, err
		}
	}
	if explicitPath != "" {
		if err := applyFile(&res, explicitPath, true); err != nil {
			return res, err
		}
	}
	return res, nil
}

func applyFile(res *Result, path string, required bool) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if !required && errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("reading %s: %w", path, err)
	}
	if err := decodeInto(&res.Config, data); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	res.Sources = append(res.Sources, path)
	return nil
}

func applyPackageJSON(res *Result, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return nil // an unreadable package.json is not commitron's problem
	}
	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal(data, &wrapper); err != nil {
		return nil // neither is a malformed one
	}
	section, ok := wrapper[PackageJSONKey]
	if !ok {
		return nil
	}
	if err := decodeInto(&res.Config, section); err != nil {
		return fmt.Errorf("%s (%q): %w", path, PackageJSONKey, err)
	}
	res.Sources = append(res.Sources, path+" ("+PackageJSONKey+")")
	return nil
}

// decodeInto overlays JSON onto an already-populated Config: absent keys keep
// their current value, which is exactly the merge semantics we want.
// Unknown keys are an error so a typo fails loudly instead of being ignored.
func decodeInto(cfg *Config, data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(cfg); err != nil {
		return err
	}
	return nil
}
