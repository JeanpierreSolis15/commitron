package ui

import (
	"fmt"
	"os"
	"sync"
	"time"
)

const frameEvery = 80 * time.Millisecond

type Spinner struct {
	theme *Theme
	live  bool
	start time.Time

	mu    sync.Mutex
	label string

	done chan struct{}
	wg   sync.WaitGroup
}

func (t *Theme) NewSpinner() *Spinner {
	return &Spinner{
		theme: t,
		live:  IsTerminal(os.Stderr),
		label: "starting",
		done:  make(chan struct{}),
	}
}

func (s *Spinner) Start() {
	s.start = time.Now()
	if !s.live {
		return
	}
	fmt.Fprint(os.Stderr, cursorHide)
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(frameEvery)
		defer ticker.Stop()
		for {
			select {
			case <-s.done:
				return
			case <-ticker.C:
				s.draw()
			}
		}
	}()
	s.draw()
}

func (s *Spinner) Status(text string) {
	s.mu.Lock()
	s.label = text
	s.mu.Unlock()
	if s.live {
		s.draw()
		return
	}
	fmt.Fprintf(os.Stderr, "%s %s\n", s.theme.Glyph.Dot, text)
}

func (s *Spinner) draw() {
	elapsed := time.Since(s.start)
	frames := s.theme.spinner
	frame := frames[int(elapsed/frameEvery)%len(frames)]

	s.mu.Lock()
	label := s.label
	s.mu.Unlock()

	fmt.Fprintf(os.Stderr, "%s%s %s %s",
		clearLine,
		s.theme.Clay(frame),
		s.theme.Dim(label),
		s.theme.Dim(fmt.Sprintf("%.1fs", elapsed.Seconds())),
	)
}

func (s *Spinner) Stop() {
	if !s.live {
		return
	}
	select {
	case <-s.done:
		return
	default:
		close(s.done)
	}
	s.wg.Wait()
	fmt.Fprint(os.Stderr, clearLine+cursorShow)
}
