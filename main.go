package main

import (
	"os"

	"github.com/JeanpierreSolis15/commitron/internal/cli"
)

func main() {
	os.Exit(cli.Main(os.Args[1:]))
}
