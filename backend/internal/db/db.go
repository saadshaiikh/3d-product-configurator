package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	DatabaseURL string
	MaxConns    int32
	MinConns    int32
	ConnTimeout time.Duration
	MaxConnLife time.Duration
	MaxConnIdle time.Duration
}

func Open(ctx context.Context, cfg Config) (*pgxpool.Pool, error) {
	pgxCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	// reasonable defaults for minimal production-ready
	if cfg.MaxConns <= 0 {
		cfg.MaxConns = 10
	}
	if cfg.MinConns < 0 {
		cfg.MinConns = 0
	}
	if cfg.MaxConnLife == 0 {
		cfg.MaxConnLife = 30 * time.Minute
	}
	if cfg.MaxConnIdle == 0 {
		cfg.MaxConnIdle = 5 * time.Minute
	}

	pgxCfg.MaxConns = cfg.MaxConns
	pgxCfg.MinConns = cfg.MinConns
	pgxCfg.MaxConnLifetime = cfg.MaxConnLife
	pgxCfg.MaxConnIdleTime = cfg.MaxConnIdle
	if cfg.ConnTimeout > 0 {
		pgxCfg.ConnConfig.ConnectTimeout = cfg.ConnTimeout
	}

	pool, err := pgxpool.NewWithConfig(ctx, pgxCfg)
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}
