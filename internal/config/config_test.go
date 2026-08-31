package config

import "testing"

func TestDefaultsAreValid(t *testing.T) {
	if err := Defaults().Validate(); err != nil {
		t.Fatalf("the built-in defaults must always validate: %v", err)
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*Config)
		wantErr bool
	}{
		{name: "defaults", mutate: func(*Config) {}},
		{name: "empty model", mutate: func(c *Config) { c.Model = "" }, wantErr: true},
		{name: "timeout too low", mutate: func(c *Config) { c.TimeoutSeconds = 1 }, wantErr: true},
		{name: "empty language", mutate: func(c *Config) { c.Language = "" }, wantErr: true},
		{name: "no types", mutate: func(c *Config) { c.Types = nil }, wantErr: true},
		{name: "subject too short", mutate: func(c *Config) { c.SubjectMaxLength = 5 }, wantErr: true},
		{name: "diff budget too small", mutate: func(c *Config) { c.MaxDiffChars = 10 }, wantErr: true},
		{name: "negative instructions budget", mutate: func(c *Config) { c.InstructionsMaxChars = -1 }, wantErr: true},
		{name: "bad body mode", mutate: func(c *Config) { c.Body = "sometimes" }, wantErr: true},
		{name: "bad color mode", mutate: func(c *Config) { c.Color = "yes" }, wantErr: true},
		{name: "bad unicode mode", mutate: func(c *Config) { c.Unicode = "maybe" }, wantErr: true},
		{name: "body never is fine", mutate: func(c *Config) { c.Body = "never" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Defaults()
			tt.mutate(&cfg)
			err := cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAllowsType(t *testing.T) {
	cfg := Defaults()
	if !cfg.AllowsType("feat") {
		t.Error("feat should be allowed by default")
	}
	if cfg.AllowsType("banana") {
		t.Error("banana should not be allowed")
	}
}
