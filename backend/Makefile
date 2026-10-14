# Needs: go, sqlc, goose, golangci-lint (go install … — see docs/shared/00-platform.md Demo).
# Windows without make: run the command after each target by hand.
-include .env
export

.PHONY: run test lint sqlc migrate-up migrate-down migrate-status migrate-new db-up dev-session

run:
	APP_ENV=development go run ./cmd/api

test:
	go test ./... -race

lint:
	golangci-lint run

sqlc:
	sqlc generate

migrate-up:
	goose -dir db/migrations postgres "$(DATABASE_URL)" up

migrate-down:
	goose -dir db/migrations postgres "$(DATABASE_URL)" down

migrate-status:
	goose -dir db/migrations postgres "$(DATABASE_URL)" status

# make migrate-new name=<module>_<change>
migrate-new:
	goose -dir db/migrations -s=false create $(name) sql

db-up:
	docker compose -f ../docker-compose.yml up -d db

# prints a session token for a demo user (dev/UAT only): make dev-session role=technician
dev-session:
	APP_ENV=development go run ./cmd/devsession -role $(or $(role),employee)
