package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func isolateGlobal(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("AppData", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HOME", dir)
	path, err := GlobalPath()
	if err != nil {
		t.Fatal(err)
	}
	return path
}

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestLoadDefaultsWhenNothingExists(t *testing.T) {
	isolateGlobal(t)
	res, err := Load(t.TempDir(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Sources) != 0 {
		t.Errorf("expected no sources, got %v", res.Sources)
	}
	if res.Config.Model != Defaults().Model {
		t.Errorf("Model = %q, want the default", res.Config.Model)
	}
}

func TestLoadMergesFieldByField(t *testing.T) {
	isolateGlobal(t)
	root := t.TempDir()

	write(t, filepath.Join(root, FileName), `{"model":"opus"}`)

	res, err := Load(root, "")
	if err != nil {
		t.Fatal(err)
	}
	if res.Config.Model != "opus" {
		t.Errorf("Model = %q, want opus", res.Config.Model)
	}
	if res.Config.SubjectMaxLength != Defaults().SubjectMaxLength {
		t.Errorf("SubjectMaxLength = %d, the file did not declare it", res.Config.SubjectMaxLength)
	}
	if len(res.Config.Types) != len(Defaults().Types) {
		t.Errorf("Types was replaced by an undeclared key")
	}
}

func TestLoadPrecedence(t *testing.T) {
	globalPath := isolateGlobal(t)
	root := t.TempDir()

	write(t, globalPath, `{"model":"from-global","language":"de","subjectMaxLength":50}`)
	write(t, filepath.Join(root, "package.json"),
		`{"name":"x","commitron":{"model":"from-package","language":"fr"}}`)
	write(t, filepath.Join(root, FileName),
		`{"model":"from-repo"}`)

	explicit := filepath.Join(t.TempDir(), "extra.json")
	write(t, explicit, `{"body":"never"}`)

	res, err := Load(root, explicit)
	if err != nil {
		t.Fatal(err)
	}
	if res.Config.Model != "from-repo" {
		t.Errorf("Model = %q, .commitron.json should win over package.json and global", res.Config.Model)
	}
	if res.Config.Language != "fr" {
		t.Errorf("Language = %q, package.json should win over global", res.Config.Language)
	}
	if res.Config.SubjectMaxLength != 50 {
		t.Errorf("SubjectMaxLength = %d, the global value should survive", res.Config.SubjectMaxLength)
	}
	if res.Config.Body != "never" {
		t.Errorf("Body = %q, --config should win", res.Config.Body)
	}
	if len(res.Sources) != 4 {
		t.Errorf("want 4 sources, got %v", res.Sources)
	}
}

func TestLoadRejectsUnknownKeys(t *testing.T) {
	isolateGlobal(t)
	root := t.TempDir()
	write(t, filepath.Join(root, FileName), `{"modelo":"opus"}`)

	if _, err := Load(root, ""); err == nil {
		t.Fatal("a misspelled key must fail loudly")
	} else if !strings.Contains(err.Error(), "modelo") {
		t.Errorf("the error should name the offending key, got: %v", err)
	}
}

func TestLoadAcceptsSchemaKey(t *testing.T) {
	isolateGlobal(t)
	root := t.TempDir()
	write(t, filepath.Join(root, FileName), `{"$schema":"`+SchemaURL+`","model":"opus"}`)

	if _, err := Load(root, ""); err != nil {
		t.Fatalf("$schema must be accepted: %v", err)
	}
}

func TestLoadIgnoresPackageJSONWithoutOurKey(t *testing.T) {
	isolateGlobal(t)
	root := t.TempDir()
	write(t, filepath.Join(root, "package.json"), `{"name":"x","scripts":{}}`)

	res, err := Load(root, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Sources) != 0 {
		t.Errorf("a package.json without our key is not a source, got %v", res.Sources)
	}
}

func TestLoadSurvivesBrokenPackageJSON(t *testing.T) {
	isolateGlobal(t)
	root := t.TempDir()
	write(t, filepath.Join(root, "package.json"), `{not json`)

	if _, err := Load(root, ""); err != nil {
		t.Fatalf("someone else's broken package.json is not our problem: %v", err)
	}
}

func TestLoadFailsOnMissingExplicitConfig(t *testing.T) {
	isolateGlobal(t)
	if _, err := Load(t.TempDir(), filepath.Join(t.TempDir(), "nope.json")); err == nil {
		t.Fatal("an explicitly requested config file must exist")
	}
}
