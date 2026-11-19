// A local spike, not part of the game: the built site in a MyGo app, with
// the update check the game would need. Built with `mygo build` from this
// folder; the version and the update feed come from mygo.json.
//
// Run with SPIKE_UPDATE=auto to check the feed a few seconds after launch,
// install what it finds and relaunch; every step is appended to
// /tmp/mygo-update.log, which survives the relaunch.
package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"time"

	"github.com/egoist/mygo"
)

//go:embed all:dist
var site embed.FS

const logPath = "/tmp/mygo-update.log"

func logf(format string, a ...any) {
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, a...))
}

func main() {
	front, err := fs.Sub(site, "dist")
	if err != nil {
		log.Fatal(err)
	}
	mygo.SetFrontend(front)
	mygo.App.WhenReady(func() {
		logf("running version %s", mygo.App.Version())
		mygo.NewWindow(mygo.WindowOptions{
			Title:     "山门之外",
			URL:       "/",
			Width:     1280,
			Height:    800,
			MinWidth:  960,
			MinHeight: 600,
		})
		if os.Getenv("SPIKE_UPDATE") == "auto" {
			go checkForUpdates()
		}
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// checkForUpdates asks the feed once, installs what it finds, and relaunches.
func checkForUpdates() {
	time.Sleep(3 * time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	logf("check: enabled=%v", mygo.Updater.Enabled())
	up, err := mygo.Updater.Check(ctx)
	if err != nil {
		logf("check: error: %v", err)
		return
	}
	if up == nil {
		logf("check: up to date")
		return
	}
	logf("check: found %s", up.Version)
	if err := up.Install(ctx, func(downloaded, total int64) {}); err != nil {
		logf("install: error: %v", err)
		return
	}
	logf("install: %s done, relaunching", up.Version)
	mygo.App.Relaunch()
}
