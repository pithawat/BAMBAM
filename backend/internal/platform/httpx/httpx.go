// Package httpx writes the response envelope from docs/shared/architecture.md
// and maps domain errors to HTTP status codes.
package httpx

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

type Meta struct {
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func List(c *gin.Context, data any, meta Meta) {
	c.JSON(http.StatusOK, gin.H{"data": data, "meta": meta})
}

// Error writes the error envelope. Unknown errors become a generic 500 and are logged.
func Error(c *gin.Context, err error) {
	e, ok := apperr.As(err)
	if !ok {
		slog.ErrorContext(c.Request.Context(), "unhandled error", "err", err, "path", c.FullPath())
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": errorBody{Code: "INTERNAL", Message: "internal error"}})
		return
	}
	c.AbortWithStatusJSON(status(e.Kind), gin.H{"error": errorBody{Code: e.Code, Message: e.Message, Fields: e.Fields}})
}

func status(k apperr.Kind) int {
	switch k {
	case apperr.KindInvalid:
		return http.StatusBadRequest
	case apperr.KindUnauthenticated:
		return http.StatusUnauthorized
	case apperr.KindForbidden:
		return http.StatusForbidden
	case apperr.KindNotFound:
		return http.StatusNotFound
	case apperr.KindConflict:
		return http.StatusConflict
	case apperr.KindBusinessRule:
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

// Page reads ?page=&pageSize= with the defaults from architecture.md (20, max 100).
func Page(c *gin.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.Query("page"))
	pageSize, _ = strconv.Atoi(c.Query("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}
