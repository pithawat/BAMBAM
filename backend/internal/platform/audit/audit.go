// Package audit appends rows to platform.audit_log (settings F30, BR-ALL-4). Writers pass the
// transaction of the change itself so the row commits or rolls back with it.
package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

// Entry is one audit row. Data is any JSON-marshallable value (nil = {}).
type Entry struct {
	ActorID    *uuid.UUID
	Action     string
	TargetType string
	TargetID   string
	Data       any
}

// Write inserts the entry using tx (a pgx.Tx or the pool).
func Write(ctx context.Context, tx platformdb.DBTX, e Entry) error {
	data := []byte("{}")
	if e.Data != nil {
		var err error
		if data, err = json.Marshal(e.Data); err != nil {
			return fmt.Errorf("marshal audit data: %w", err)
		}
	}
	return platformdb.New(tx).InsertAuditLog(ctx, platformdb.InsertAuditLogParams{
		ActorUserID: e.ActorID,
		Action:      e.Action,
		TargetType:  optional(e.TargetType),
		TargetID:    optional(e.TargetID),
		Data:        data,
	})
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
