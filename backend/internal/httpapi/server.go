package httpapi

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"yourrepo/backend/internal/sqlc/dbgen"
)

type Server struct {
	DB            *pgxpool.Pool
	Queries       *dbgen.Queries
	WS            *WSHubManager
	OriginChecker OriginChecker
	StaticDir     string
	PublicBaseURL string
	SerpAPIKey    string
	OpenAIKey     string
}
