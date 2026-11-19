// A local spike, not part of the game: the built site in a MyGo window
// (github.com/egoist/mygo), to see whether a Go host serves it and draws it
// as Pake's does. Run from this folder after copying the built site:
//
//     cp -R ../../dist .
//     go run .
package main

import (
	"embed"
	"io/fs"
	"log"
	"os"

	"github.com/egoist/mygo"
)

// The files `pnpm build` writes. Copied here rather than built, since the
// spike only needs the site as it is.
//
//go:embed all:dist
var site embed.FS

func main() {
	front, err := fs.Sub(site, "dist")
	if err != nil {
		log.Fatal(err)
	}
	// mygo://localhost/ serves the site's files; the game finds its textures,
	// models and the Basis transcoder from the page's own address.
	mygo.SetFrontend(front)
	url := os.Getenv("SPIKE_URL")
	if url == "" {
		url = "/"
	}
	mygo.App.WhenReady(func() {
		mygo.NewWindow(mygo.WindowOptions{
			Title:     "山门之外",
			URL:       url,
			Width:     1280,
			Height:    800,
			MinWidth:  960,
			MinHeight: 600,
		})
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
