package middleware

import (
	"context"
	"io"
	"log/slog"
)

// NewLogger returns a slog logger: text in development, JSON elsewhere,
// always with request_id when the context has one.
func NewLogger(w io.Writer, json bool) *slog.Logger {
	var h slog.Handler
	if json {
		h = slog.NewJSONHandler(w, nil)
	} else {
		h = newDevHandler(w)
	}
	return slog.New(requestIDHandler{h})
}

type requestIDHandler struct{ slog.Handler }

func (h requestIDHandler) Handle(ctx context.Context, r slog.Record) error {
	if id := RequestIDFromContext(ctx); id != "" {
		r.AddAttrs(slog.String("request_id", id))
	}
	return h.Handler.Handle(ctx, r)
}

func (h requestIDHandler) WithAttrs(a []slog.Attr) slog.Handler {
	return requestIDHandler{h.Handler.WithAttrs(a)}
}

func (h requestIDHandler) WithGroup(n string) slog.Handler {
	return requestIDHandler{h.Handler.WithGroup(n)}
}
