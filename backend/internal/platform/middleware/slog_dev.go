package middleware

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"sync"
)

// devHandler prints one compact line per record for local development:
//
//	11:46:37 INF GET /api/auth/login 302 0ms [4e433ef5]
//	11:46:37 WRN sso login failed reason=id_token_invalid err="…" [8e5ed7e4]
//
// Production keeps the JSON handler.
type devHandler struct {
	mu    *sync.Mutex
	w     io.Writer
	attrs []slog.Attr
}

func newDevHandler(w io.Writer) slog.Handler { return devHandler{mu: &sync.Mutex{}, w: w} }

func (h devHandler) Enabled(context.Context, slog.Level) bool { return true }

func (h devHandler) WithAttrs(a []slog.Attr) slog.Handler {
	h.attrs = append(append([]slog.Attr(nil), h.attrs...), a...)
	return h
}

func (h devHandler) WithGroup(string) slog.Handler { return h }

func (h devHandler) Handle(_ context.Context, r slog.Record) error {
	attrs := append([]slog.Attr(nil), h.attrs...)
	r.Attrs(func(a slog.Attr) bool { attrs = append(attrs, a); return true })

	var b strings.Builder
	fmt.Fprintf(&b, "%s %s ", r.Time.Format("15:04:05"), levelTag(r.Level))

	vals := map[string]string{}
	var rest []slog.Attr
	for _, a := range attrs {
		vals[a.Key] = a.Value.String()
		rest = append(rest, a)
	}

	if r.Message == "request" {
		fmt.Fprintf(&b, "%s %s %s %sms", vals["method"], vals["route"], vals["status"], vals["duration_ms"])
	} else {
		b.WriteString(r.Message)
		for _, a := range rest {
			if a.Key == "request_id" {
				continue
			}
			fmt.Fprintf(&b, " %s=%s", a.Key, quoteIfNeeded(a.Value.String()))
		}
	}
	if id := vals["request_id"]; id != "" {
		if len(id) > 8 {
			id = id[:8]
		}
		fmt.Fprintf(&b, " [%s]", id)
	}
	b.WriteByte('\n')

	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := io.WriteString(h.w, b.String())
	return err
}

func levelTag(l slog.Level) string {
	switch {
	case l >= slog.LevelError:
		return "ERR"
	case l >= slog.LevelWarn:
		return "WRN"
	case l >= slog.LevelInfo:
		return "INF"
	default:
		return "DBG"
	}
}

func quoteIfNeeded(s string) string {
	if strings.ContainsAny(s, " \t\"") {
		return fmt.Sprintf("%q", s)
	}
	return s
}
