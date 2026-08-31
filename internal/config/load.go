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

const FileName = ".commitron.json"

const PackageJSONKey = "commitron"

type Result struct {
	Config  Config
	Sources []string
}

func GlobalPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "commitron", "config.json"), nil
}

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
		return nil
	}
	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal(data, &wrapper); err != nil {
		return nil
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

func decodeInto(cfg *Config, data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	return dec.Decode(cfg)
}
