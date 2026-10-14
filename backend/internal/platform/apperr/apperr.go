// Package apperr holds transport-free domain errors. Services return them;
// httpx maps the Kind to an HTTP status.
package apperr

import "errors"

type Kind int

const (
	KindInvalid Kind = iota + 1 // bad input
	KindUnauthenticated
	KindForbidden
	KindNotFound
	KindConflict
	KindBusinessRule
)

// Error carries a stable UPPER_SNAKE code (documented in 04-api-contract.md)
// and an English debug message that is never shown to users.
type Error struct {
	Kind    Kind
	Code    string
	Message string
	Fields  map[string]string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func New(kind Kind, code, message string) *Error {
	return &Error{Kind: kind, Code: code, Message: message}
}

// Validation builds a 400 VALIDATION_FAILED with field codes (REQUIRED, TOO_LONG, INVALID, …).
func Validation(fields map[string]string) *Error {
	return &Error{Kind: KindInvalid, Code: "VALIDATION_FAILED", Message: "validation failed", Fields: fields}
}

var (
	ErrUnauthenticated = New(KindUnauthenticated, "UNAUTHENTICATED", "no or expired session")
	ErrForbidden       = New(KindForbidden, "FORBIDDEN", "not allowed")
	ErrNotFound        = New(KindNotFound, "NOT_FOUND", "not found")
)

func As(err error) (*Error, bool) {
	var e *Error
	ok := errors.As(err, &e)
	return e, ok
}
