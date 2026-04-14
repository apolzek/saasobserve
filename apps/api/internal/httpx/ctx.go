package httpx

import (
	"context"

	"github.com/apolzek/saasobserve/apps/api/internal/db"
)

func withUser(ctx context.Context, u *db.User) context.Context {
	return context.WithValue(ctx, userKey, u)
}

func userFrom(ctx context.Context) *db.User {
	if u, ok := ctx.Value(userKey).(*db.User); ok {
		return u
	}
	return nil
}
